import { getDb } from "./server/db";
import {
  tenants,
  clients,
  invoiceArchive,
  invoiceArchiveLines,
  emittedInvoices,
  emittedInvoiceLines,
  nir,
  nirLines,
} from "./drizzle/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

function buildUblXml(params: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  supplier: {
    name: string;
    cui: string;
    regCom?: string;
    address: string;
    city: string;
    country?: string;
  };
  customer: {
    name: string;
    cui: string;
    address: string;
    city: string;
    country?: string;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    unit: string;
    vatRate: number;
    total: number;
  }>;
  subtotal: number;
  totalVat: number;
  total: number;
}) {
  const { invoiceNumber, issueDate, dueDate, supplier, customer, lines, subtotal, totalVat, total } = params;

  const cleanSupplierCui = supplier.cui.replace(/[^0-9]/g, "");
  const cleanCustomerCui = customer.cui.replace(/[^0-9]/g, "");

  const xmlLines = lines
    .map(
      (l, idx) => `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${l.unit === "mp" ? "MTK" : l.unit === "l" ? "LTR" : "H87"}">${l.quantity.toFixed(2)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="RON">${(l.quantity * l.unitPrice).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${l.description}</cbc:Description>
      <cbc:Name>${l.description}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${l.vatRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="RON">${l.unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>${invoiceNumber}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${supplier.name}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${supplier.address}</cbc:StreetName>
        <cbc:CityName>${supplier.city}</cbc:CityName>
        <cbc:CountrySubentity>RO-B</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>${supplier.country || "RO"}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO${cleanSupplierCui}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${supplier.name}</cbc:RegistrationName>
        <cbc:CompanyID>RO${cleanSupplierCui}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${customer.name}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${customer.address}</cbc:StreetName>
        <cbc:CityName>${customer.city}</cbc:CityName>
        <cbc:CountrySubentity>RO-B</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>${customer.country || "RO"}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO${cleanCustomerCui}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${customer.name}</cbc:RegistrationName>
        <cbc:CompanyID>RO${cleanCustomerCui}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">${totalVat.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RON">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RON">${totalVat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RON">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RON">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

${xmlLines}
</Invoice>`;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB unavailable");
    process.exit(1);
  }

  const TENANT_ID = 2;
  console.log(`Setting up demo data for Tenant ID: ${TENANT_ID}...`);

  // 1. Update Tenant Details & Company Settings
  const companySettings = {
    regCom: "J40/1234/2024",
    city: "București",
    county: "București",
    country: "RO",
    iban: "RO49BTRL00012345678901RO",
    bank: "Banca Transilvania",
    ibanEur: "RO49BTRL00012345678902EU",
    bankEur: "Banca Transilvania",
    bankAccounts: [
      {
        id: "ron-1",
        currency: "RON",
        iban: "RO49BTRL00012345678901RO",
        bank: "Banca Transilvania",
        isDefault: true,
      },
      {
        id: "eur-1",
        currency: "EUR",
        iban: "RO49BTRL00012345678902EU",
        bank: "Banca Transilvania",
        isDefault: false,
      },
    ],
    defaultCurrency: "RON",
    defaultLanguage: "ro",
    defaultVatRate: 19,
    invoicePrefix: "FACT",
    invoiceStartNumber: 1,
    defaultDueDays: 15,
    defaultMarkupPercent: 20,
  };

  await db
    .update(tenants)
    .set({
      name: "eugen7ro Workspace S.R.L.",
      cui: "RO45982140",
      phone: "+40 721 123 456",
      address: "Str. Aviatorilor nr. 24, Sector 1, București",
      settings: JSON.stringify(companySettings),
    })
    .where(eq(tenants.id, TENANT_ID));
  console.log("✓ Updated tenant company profile and settings");

  // 2. Clean previous demo data for Tenant 2 (Idempotency)
  // Get invoiceArchive IDs for tenant 2
  const existingArchives = await db
    .select({ id: invoiceArchive.id })
    .from(invoiceArchive)
    .where(eq(invoiceArchive.tenantId, TENANT_ID));
  for (const a of existingArchives) {
    await db.delete(invoiceArchiveLines).where(eq(invoiceArchiveLines.invoiceArchiveId, a.id));
  }
  await db.delete(invoiceArchive).where(eq(invoiceArchive.tenantId, TENANT_ID));

  // Get emittedInvoices IDs for tenant 2
  const existingEmitted = await db
    .select({ id: emittedInvoices.id })
    .from(emittedInvoices)
    .where(eq(emittedInvoices.tenantId, TENANT_ID));
  for (const e of existingEmitted) {
    await db.delete(emittedInvoiceLines).where(eq(emittedInvoiceLines.emittedInvoiceId, e.id));
  }
  await db.delete(emittedInvoices).where(eq(emittedInvoices.tenantId, TENANT_ID));

  // Clean NIR for tenant 2
  const existingNir = await db
    .select({ id: nir.id })
    .from(nir)
    .where(eq(nir.tenantId, TENANT_ID));
  for (const n of existingNir) {
    await db.delete(nirLines).where(eq(nirLines.nirId, n.id));
  }
  await db.delete(nir).where(eq(nir.tenantId, TENANT_ID));

  // Clean clients for tenant 2
  await db.delete(clients).where(eq(clients.tenantId, TENANT_ID));
  console.log("✓ Cleaned previous records for tenant 2");

  // 3. Insert Suppliers (isSupplier = 1)
  const supplierData = [
    {
      name: "DEDEMAN S.R.L.",
      cui: "RO2816464",
      regCom: "J04/2621/1992",
      address: "Str. Republicii nr. 185",
      city: "Bacău",
      email: "contact@dedeman.ro",
      phone: "0234513330",
      totalInvoiced: "5630.00",
      invoiceCount: 2,
      isSupplier: 1,
      tva: 1,
    },
    {
      name: "DANTE INTERNATIONAL S.A. (eMAG)",
      cui: "RO14399840",
      regCom: "J40/372/2002",
      address: "Șos. Virtuții nr. 148, Sector 6",
      city: "București",
      email: "office@emag.ro",
      phone: "0212005200",
      totalInvoiced: "4899.99",
      invoiceCount: 1,
      isSupplier: 1,
      tva: 1,
    },
    {
      name: "ORANGE ROMANIA S.A.",
      cui: "RO427320",
      regCom: "J40/10178/1996",
      address: "Bd. Lascăr Catargiu nr. 51-53, Sector 1",
      city: "București",
      email: "corporate@orange.ro",
      phone: "0212033030",
      totalInvoiced: "645.50",
      invoiceCount: 1,
      isSupplier: 1,
      tva: 1,
    },
    {
      name: "OMV PETROM MARKETING S.R.L.",
      cui: "RO11201891",
      regCom: "J40/10637/1998",
      address: "Str. Coralilor nr. 22, Sector 1",
      city: "București",
      email: "office@petrom.ro",
      phone: "0214060101",
      totalInvoiced: "1280.00",
      invoiceCount: 1,
      isSupplier: 1,
      tva: 1,
    },
    {
      name: "PPC ENERGIE S.A.",
      cui: "RO24387371",
      regCom: "J40/14506/2008",
      address: "Bd. Mircea Vodă nr. 30, Sector 3",
      city: "București",
      email: "contact@ppcenergy.ro",
      phone: "0219977",
      totalInvoiced: "890.20",
      invoiceCount: 1,
      isSupplier: 1,
      tva: 1,
    },
    {
      name: "METRO CASH & CARRY ROMANIA S.R.L.",
      cui: "RO8624710",
      regCom: "J23/1199/2008",
      address: "Bd. București nr. 89-91",
      city: "Voluntari",
      email: "clienti@metro.ro",
      phone: "0374115555",
      totalInvoiced: "1540.00",
      invoiceCount: 1,
      isSupplier: 1,
      tva: 1,
    },
  ];

  for (const s of supplierData) {
    await db.insert(clients).values({
      tenantId: TENANT_ID,
      ...s,
    });
  }
  console.log(`✓ Inserted ${supplierData.length} Romanian suppliers into clients directory`);

  // 4. Insert Customers (isSupplier = 0)
  const customerData = [
    {
      name: "NEXUS DIGITAL SOLUTIONS S.R.L.",
      cui: "RO38192014",
      regCom: "J40/14230/2017",
      address: "Str. Barbu Văcărescu nr. 102, Sector 2",
      city: "București",
      email: "office@nexusdigital.ro",
      phone: "+40 730 112 233",
      totalInvoiced: "19159.00",
      invoiceCount: 2,
      isSupplier: 0,
      tva: 1,
    },
    {
      name: "ALFA GLOBAL LOGISTICS S.R.L.",
      cui: "RO41209381",
      regCom: "J23/2410/2019",
      address: "Calea Bucureștilor nr. 224",
      city: "Otopeni",
      email: "contact@alfalogistics.ro",
      phone: "+40 722 554 433",
      totalInvoiced: "14756.00",
      invoiceCount: 1,
      isSupplier: 0,
      tva: 1,
    },
    {
      name: "BELLAGIO HORECA INVEST S.R.L.",
      cui: "RO36803566",
      regCom: "J08/1598/2016",
      address: "Str. Republicii nr. 12",
      city: "Brașov",
      email: "financiar@bellagio-horeca.ro",
      phone: "+40 740 998 877",
      totalInvoiced: "7378.00",
      invoiceCount: 1,
      isSupplier: 0,
      tva: 1,
    },
    {
      name: "KRONSTADT TECH ENGINEERING S.R.L.",
      cui: "RO29837102",
      regCom: "J08/1120/2012",
      address: "Str. Zizinului nr. 110",
      city: "Brașov",
      email: "procurement@kronstadt-tech.ro",
      phone: "+40 721 889 900",
      totalInvoiced: "18802.00",
      invoiceCount: 1,
      isSupplier: 0,
      tva: 1,
    },
    {
      name: "EUROPA TRADE & DISTRIBUTION S.R.L.",
      cui: "RO33419082",
      regCom: "J12/2100/2014",
      address: "Str. Observatorului nr. 34",
      city: "Cluj-Napoca",
      email: "contabilitate@europatrade.ro",
      phone: "+40 755 332 211",
      totalInvoiced: "10948.00",
      invoiceCount: 1,
      isSupplier: 0,
      tva: 1,
    },
  ];

  const insertedClientsMap: Record<string, number> = {};
  for (const c of customerData) {
    const [res] = await db.insert(clients).values({
      tenantId: TENANT_ID,
      ...c,
    });
    insertedClientsMap[c.name] = res.insertId;
  }
  console.log(`✓ Inserted ${customerData.length} Romanian customers into clients directory`);

  // 5. Insert Received Invoices (Facturi Primite) in invoiceArchive
  const myCompany = {
    name: "eugen7ro Workspace S.R.L.",
    cui: "RO45982140",
    address: "Str. Aviatorilor nr. 24, Sector 1",
    city: "București",
    country: "RO",
  };

  const receivedInvoices = [
    {
      number: "DED-2026-849201",
      supplier: {
        name: "DEDEMAN S.R.L.",
        cui: "RO2816464",
        address: "Str. Republicii nr. 185",
        city: "Bacău",
      },
      issueDate: "2026-08-10",
      dueDate: "2026-09-09",
      subtotal: 2899.16,
      totalVat: 550.84,
      total: 3450.0,
      status: "processed" as const, // Achitat
      lines: [
        {
          description: "Parchet laminat 10mm trafic intens stejar natural",
          quantity: 60,
          unitPrice: 48.32,
          unit: "mp",
          vatRate: 19,
          total: 3450.0,
        },
      ],
      tags: '["Materiale", "Amenajare"]',
    },
    {
      number: "EMAG-9921443",
      supplier: {
        name: "DANTE INTERNATIONAL S.A. (eMAG)",
        cui: "RO14399840",
        address: "Șos. Virtuții nr. 148, Sector 6",
        city: "București",
      },
      issueDate: "2026-08-18",
      dueDate: "2026-09-02",
      subtotal: 4117.64,
      totalVat: 782.35,
      total: 4899.99,
      status: "processed" as const, // Achitat
      lines: [
        {
          description: "Laptop Dell Vostro 15 i7 16GB SSD 512GB Windows Pro",
          quantity: 1,
          unitPrice: 4117.64,
          unit: "buc",
          vatRate: 19,
          total: 4899.99,
        },
      ],
      tags: '["Echipamente IT", "Birou"]',
    },
    {
      number: "ORNG-2026-4401",
      supplier: {
        name: "ORANGE ROMANIA S.A.",
        cui: "RO427320",
        address: "Bd. Lascăr Catargiu nr. 51-53, Sector 1",
        city: "București",
      },
      issueDate: "2026-08-25",
      dueDate: "2026-09-10",
      subtotal: 542.44,
      totalVat: 103.06,
      total: 645.5,
      status: "processed" as const, // Achitat
      lines: [
        {
          description: "Abonament telefonie și internet mobil business 4 linii",
          quantity: 1,
          unitPrice: 542.44,
          unit: "buc",
          vatRate: 19,
          total: 645.5,
        },
      ],
      tags: '["Utilități", "Telecom"]',
    },
    {
      number: "OMV-0049219",
      supplier: {
        name: "OMV PETROM MARKETING S.R.L.",
        cui: "RO11201891",
        address: "Str. Coralilor nr. 22, Sector 1",
        city: "București",
      },
      issueDate: "2026-08-29",
      dueDate: "2026-09-15",
      subtotal: 1075.63,
      totalVat: 204.37,
      total: 1280.0,
      status: "processed" as const, // Achitat
      lines: [
        {
          description: "Carburant MaxxMotion Diesel - Flotă auto comercială",
          quantity: 185.5,
          unitPrice: 5.8,
          unit: "l",
          vatRate: 19,
          total: 1280.0,
        },
      ],
      tags: '["Auto", "Combustibil"]',
    },
    {
      number: "PPC-2026-0918",
      supplier: {
        name: "PPC ENERGIE S.A.",
        cui: "RO24387371",
        address: "Bd. Mircea Vodă nr. 30, Sector 3",
        city: "București",
      },
      issueDate: "2026-09-02",
      dueDate: "2026-09-22",
      subtotal: 748.07,
      totalVat: 142.13,
      total: 890.2,
      status: "pending" as const, // Neachitat
      lines: [
        {
          description: "Consum energie electrică sediu administrativ - August 2026",
          quantity: 1,
          unitPrice: 748.07,
          unit: "buc",
          vatRate: 19,
          total: 890.2,
        },
      ],
      tags: '["Utilități", "Energie"]',
    },
    {
      number: "METRO-2026-302",
      supplier: {
        name: "METRO CASH & CARRY ROMANIA S.R.L.",
        cui: "RO8624710",
        address: "Bd. București nr. 89-91",
        city: "Voluntari",
      },
      issueDate: "2026-09-06",
      dueDate: "2026-09-21",
      subtotal: 1294.12,
      totalVat: 245.88,
      total: 1540.0,
      status: "pending" as const, // Neachitat
      lines: [
        {
          description: "Consumabile birou, protocol, cafea boabe și produse curățenie",
          quantity: 1,
          unitPrice: 1294.12,
          unit: "buc",
          vatRate: 19,
          total: 1540.0,
        },
      ],
      tags: '["Protocol", "Consumabile"]',
    },
    {
      number: "DED-2026-891044",
      supplier: {
        name: "DEDEMAN S.R.L.",
        cui: "RO2816464",
        address: "Str. Republicii nr. 185",
        city: "Bacău",
      },
      issueDate: "2026-09-10",
      dueDate: "2026-10-10",
      subtotal: 1831.93,
      totalVat: 348.07,
      total: 2180.0,
      status: "pending" as const, // Neachitat
      lines: [
        {
          description: "Materiale reamenajare spațiu birou, lavabilă și corpuri iluminat LED",
          quantity: 1,
          unitPrice: 1831.93,
          unit: "buc",
          vatRate: 19,
          total: 2180.0,
        },
      ],
      tags: '["Materiale", "Sediu"]',
    },
  ];

  const insertedArchiveIds: Record<string, number> = {};

  for (const inv of receivedInvoices) {
    const rawXml = buildUblXml({
      invoiceNumber: inv.number,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      supplier: inv.supplier,
      customer: myCompany,
      lines: inv.lines,
      subtotal: inv.subtotal,
      totalVat: inv.totalVat,
      total: inv.total,
    });

    const [inserted] = await db.insert(invoiceArchive).values({
      tenantId: TENANT_ID,
      fileName: `SPV_${inv.number.replace(/[^a-zA-Z0-9]/g, "_")}.xml`,
      fileType: "efactura",
      fileSize: rawXml.length,
      invoiceNumber: inv.number,
      supplierName: inv.supplier.name,
      supplierCUI: inv.supplier.cui,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total.toFixed(2),
      totalVAT: inv.totalVat.toFixed(2),
      currency: "RON",
      source: "spv_anaf",
      direction: "in",
      status: inv.status,
      notes: "Factură primită descărcată local (demonstrativă).",
      rawXml: rawXml,
      tags: inv.tags,
    });

    const archiveId = inserted.insertId;
    insertedArchiveIds[inv.number] = archiveId;

    for (const l of inv.lines) {
      await db.insert(invoiceArchiveLines).values({
        invoiceArchiveId: archiveId,
        description: l.description,
        quantity: l.quantity.toFixed(2),
        unitPrice: l.unitPrice.toFixed(2),
        unit: l.unit,
        vatRate: l.vatRate.toFixed(2),
        total: l.total.toFixed(2),
        currency: "RON",
      });
    }
  }
  console.log(`✓ Inserted ${receivedInvoices.length} received invoices with full UBL 2.1 XML`);

  // 6. Insert Emitted Invoices (Facturi Emise Direct din Platformă)
  const emittedInvoicesData = [
    {
      number: "FACT-2026-0001",
      series: "FACT",
      clientName: "NEXUS DIGITAL SOLUTIONS S.R.L.",
      clientCUI: "RO38192014",
      clientRegCom: "J40/14230/2017",
      clientAddress: "Str. Barbu Văcărescu nr. 102, Sector 2",
      clientCity: "București",
      clientCountry: "RO",
      clientEmail: "office@nexusdigital.ro",
      clientPhone: "+40 730 112 233",
      issueDate: "2026-08-12",
      dueDate: "2026-08-27",
      subtotal: "8500.00",
      totalVAT: "1615.00",
      total: "10115.00",
      status: "paid" as const, // Încasat
      companyIBAN: "RO49BTRL00012345678901RO",
      companyBank: "Banca Transilvania",
      notes: "Factură demonstrativă emisă local (istoric validat).",
      spvStatus: "validat" as const,
      spvIndex: "504829104",
      spvSentAt: new Date("2026-08-13T10:15:00"),
      lines: [
        {
          description: "Servicii consultanță dezvoltare software și arhitectură cloud - Luna August 2026",
          quantity: "1.00",
          unitPrice: "8500.00",
          unit: "serv",
          vatRate: "19.00",
          total: "10115.00",
        },
      ],
    },
    {
      number: "FACT-2026-0002",
      series: "FACT",
      clientName: "ALFA GLOBAL LOGISTICS S.R.L.",
      clientCUI: "RO41209381",
      clientRegCom: "J23/2410/2019",
      clientAddress: "Calea Bucureștilor nr. 224",
      clientCity: "Otopeni",
      clientCountry: "RO",
      clientEmail: "contact@alfalogistics.ro",
      clientPhone: "+40 722 554 433",
      issueDate: "2026-08-20",
      dueDate: "2026-09-04",
      subtotal: "12400.00",
      totalVAT: "2356.00",
      total: "14756.00",
      status: "paid" as const, // Încasat
      companyIBAN: "RO49BTRL00012345678901RO",
      companyBank: "Banca Transilvania",
      notes: "Factură demonstrativă emisă local (istoric validat).",
      spvStatus: "validat" as const,
      spvIndex: "504831829",
      spvSentAt: new Date("2026-08-21T11:20:00"),
      lines: [
        {
          description: "Implementare modul sincronizare date WMS și optimizare rute transport",
          quantity: "1.00",
          unitPrice: "9400.00",
          unit: "serv",
          vatRate: "19.00",
          total: "11186.00",
        },
        {
          description: "Mentenanță infrastructură servere și suport tehnic L2",
          quantity: "1.00",
          unitPrice: "3000.00",
          unit: "serv",
          vatRate: "19.00",
          total: "3570.00",
        },
      ],
    },
    {
      number: "FACT-2026-0003",
      series: "FACT",
      clientName: "BELLAGIO HORECA INVEST S.R.L.",
      clientCUI: "RO36803566",
      clientRegCom: "J08/1598/2016",
      clientAddress: "Str. Republicii nr. 12",
      clientCity: "Brașov",
      clientCountry: "RO",
      clientEmail: "financiar@bellagio-horeca.ro",
      clientPhone: "+40 740 998 877",
      issueDate: "2026-08-28",
      dueDate: "2026-09-12",
      subtotal: "6200.00",
      totalVAT: "1178.00",
      total: "7378.00",
      status: "paid" as const, // Încasat
      companyIBAN: "RO49BTRL00012345678901RO",
      companyBank: "Banca Transilvania",
      notes: "Factură demonstrativă emisă local (istoric validat).",
      spvStatus: "validat" as const,
      spvIndex: "504839440",
      spvSentAt: new Date("2026-08-29T09:40:00"),
      lines: [
        {
          description: "Configurare platformă comenzi digitale și instruire personal locație",
          quantity: "1.00",
          unitPrice: "6200.00",
          unit: "serv",
          vatRate: "19.00",
          total: "7378.00",
        },
      ],
    },
    {
      number: "FACT-2026-0004",
      series: "FACT",
      clientName: "KRONSTADT TECH ENGINEERING S.R.L.",
      clientCUI: "RO29837102",
      clientRegCom: "J08/1120/2012",
      clientAddress: "Str. Zizinului nr. 110",
      clientCity: "Brașov",
      clientCountry: "RO",
      clientEmail: "procurement@kronstadt-tech.ro",
      clientPhone: "+40 721 889 900",
      issueDate: "2026-09-08",
      dueDate: "2026-09-23",
      subtotal: "15800.00",
      totalVAT: "3002.00",
      total: "18802.00",
      status: "sent" as const, // Neîncasat
      companyIBAN: "RO49BTRL00012345678901RO",
      companyBank: "Banca Transilvania",
      notes: "Factură demonstrativă emisă local (nesincronizată în SPV).",
      spvStatus: "nesincronizat" as const,
      spvIndex: null,
      spvSentAt: null,
      lines: [
        {
          description: "Dezvoltare portal B2B comenzi industriale - Faza 1",
          quantity: "1.00",
          unitPrice: "11800.00",
          unit: "serv",
          vatRate: "19.00",
          total: "14042.00",
        },
        {
          description: "Servicii securitate cibernetică și audit conformitate IT",
          quantity: "1.00",
          unitPrice: "4000.00",
          unit: "serv",
          vatRate: "19.00",
          total: "4760.00",
        },
      ],
    },
    {
      number: "FACT-2026-0005",
      series: "FACT",
      clientName: "EUROPA TRADE & DISTRIBUTION S.R.L.",
      clientCUI: "RO33419082",
      clientRegCom: "J12/2100/2014",
      clientAddress: "Str. Observatorului nr. 34",
      clientCity: "Cluj-Napoca",
      clientCountry: "RO",
      clientEmail: "contabilitate@europatrade.ro",
      clientPhone: "+40 755 332 211",
      issueDate: "2026-09-10",
      dueDate: "2026-09-25",
      subtotal: "9200.00",
      totalVAT: "1748.00",
      total: "10948.00",
      status: "sent" as const, // Neîncasat
      companyIBAN: "RO49BTRL00012345678901RO",
      companyBank: "Banca Transilvania",
      notes: "Factură demonstrativă emisă local (nesincronizată în SPV).",
      spvStatus: "nesincronizat" as const,
      spvIndex: null,
      spvSentAt: null,
      lines: [
        {
          description: "Abonament servicii suport IT, backup și administrare rețea - Septembrie 2026",
          quantity: "1.00",
          unitPrice: "9200.00",
          unit: "serv",
          vatRate: "19.00",
          total: "10948.00",
        },
      ],
    },
    {
      number: "FACT-2026-0006",
      series: "FACT",
      clientName: "NEXUS DIGITAL SOLUTIONS S.R.L.",
      clientCUI: "RO38192014",
      clientRegCom: "J40/14230/2017",
      clientAddress: "Str. Barbu Văcărescu nr. 102, Sector 2",
      clientCity: "București",
      clientCountry: "RO",
      clientEmail: "office@nexusdigital.ro",
      clientPhone: "+40 730 112 233",
      issueDate: "2026-09-11",
      dueDate: "2026-09-26",
      subtotal: "7600.00",
      totalVAT: "1444.00",
      total: "9044.00",
      status: "sent" as const, // Neîncasat
      companyIBAN: "RO49BTRL00012345678901RO",
      companyBank: "Banca Transilvania",
      notes: "Factură demonstrativă emisă local (nesincronizată în SPV).",
      spvStatus: "nesincronizat" as const,
      spvIndex: null,
      spvSentAt: null,
      lines: [
        {
          description: "Consultanță tehnică integrare plăți electronice și automatizare flux e-Factura",
          quantity: "1.00",
          unitPrice: "7600.00",
          unit: "serv",
          vatRate: "19.00",
          total: "9044.00",
        },
      ],
    },
  ];

  for (const inv of emittedInvoicesData) {
    const clientId = insertedClientsMap[inv.clientName] || null;
    const [inserted] = await db.insert(emittedInvoices).values({
      tenantId: TENANT_ID,
      number: inv.number,
      series: inv.series,
      clientId: clientId,
      clientName: inv.clientName,
      clientCUI: inv.clientCUI,
      clientRegCom: inv.clientRegCom,
      clientAddress: inv.clientAddress,
      clientCity: inv.clientCity,
      clientCountry: inv.clientCountry,
      clientEmail: inv.clientEmail,
      clientPhone: inv.clientPhone,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: inv.subtotal,
      totalVAT: inv.totalVAT,
      total: inv.total,
      currency: "RON",
      companyIBAN: inv.companyIBAN,
      companyBank: inv.companyBank,
      status: inv.status,
      notes: inv.notes,
      spvStatus: inv.spvStatus,
      spvIndex: inv.spvIndex,
      spvSentAt: inv.spvSentAt,
    });

    const emittedId = inserted.insertId;
    let order = 0;
    for (const l of inv.lines) {
      await db.insert(emittedInvoiceLines).values({
        emittedInvoiceId: emittedId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unit: l.unit,
        vatRate: l.vatRate,
        total: l.total,
        lineOrder: order++,
      });
    }
  }
  console.log(`✓ Inserted ${emittedInvoicesData.length} emitted invoices with full line items`);

  // 7. Insert 2 NIR records for the received invoices
  const dedemanArchiveId = insertedArchiveIds["DED-2026-849201"];
  if (dedemanArchiveId) {
    const [nir1] = await db.insert(nir).values({
      tenantId: TENANT_ID,
      nirNumber: "NIR-2026-0001",
      invoiceArchiveId: dedemanArchiveId,
      invoiceNumber: "DED-2026-849201",
      supplierName: "DEDEMAN S.R.L.",
      supplierCUI: "RO2816464",
      supplierAddress: "Str. Republicii nr. 185, Bacău",
      gestiune: "Depozit Central",
      receiptDate: "2026-08-11",
      member1Name: "Popescu Andrei",
      member1Function: "Gestionar",
      member2Name: "Ionescu Radu",
      member2Function: "Director Tehnic",
      hasDifferences: 0,
      accountingType: "Marfuri",
      accountingAccount: "371",
      status: "finalizat",
      notes: "Recepție conformă calitativ și cantitativ.",
    });

    await db.insert(nirLines).values({
      nirId: nir1.insertId,
      description: "Parchet laminat 10mm trafic intens stejar natural",
      unit: "mp",
      cantitateComanda: "60.00",
      cantitateReceptionata: "60.00",
      consumedQty: "0.00",
      unitPrice: "48.32",
      vatRate: "19.00",
      total: "3450.00",
      accountingType: "Marfa",
      accountingAccount: "371",
      lineOrder: 0,
    });
  }

  const metroArchiveId = insertedArchiveIds["METRO-2026-302"];
  if (metroArchiveId) {
    const [nir2] = await db.insert(nir).values({
      tenantId: TENANT_ID,
      nirNumber: "NIR-2026-0002",
      invoiceArchiveId: metroArchiveId,
      invoiceNumber: "METRO-2026-302",
      supplierName: "METRO CASH & CARRY ROMANIA S.R.L.",
      supplierCUI: "RO8624710",
      supplierAddress: "Bd. București nr. 89-91, Voluntari",
      gestiune: "Sediu Administrativ",
      receiptDate: "2026-09-07",
      member1Name: "Popescu Andrei",
      member1Function: "Gestionar",
      hasDifferences: 0,
      accountingType: "Consumabile",
      accountingAccount: "3028",
      status: "finalizat",
      notes: "Consumabile protocol și papetărie recepționate integral.",
    });

    await db.insert(nirLines).values({
      nirId: nir2.insertId,
      description: "Consumabile birou, protocol, cafea boabe și produse curățenie",
      unit: "lot",
      cantitateComanda: "1.00",
      cantitateReceptionata: "1.00",
      consumedQty: "0.00",
      unitPrice: "1294.12",
      vatRate: "19.00",
      total: "1540.00",
      accountingType: "Consumabile",
      accountingAccount: "3028",
      lineOrder: 0,
    });
  }
  console.log("✓ Inserted 2 NIR records with lines for Gestiune");

  console.log("=========================================");
  console.log("ALL DEMO DATA SUCCESSFULLY GENERATED!");
  console.log("=========================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
