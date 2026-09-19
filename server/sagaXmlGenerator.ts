import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { format } from "date-fns";
import * as schema from "../drizzle/schema";

export interface TenantCompanyProfile {
  name: string;
  cui: string;
  regCom: string;
  country: string;
  county: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  bank: string;
  iban: string;
}

export async function getTenantCompanyProfile(tenantId: number): Promise<TenantCompanyProfile> {
  const db = await getDb();
  if (!db) {
    return {
      name: "TRADE INVEST NETWORK S.R.L.",
      cui: "RO42322117",
      regCom: "J2020002825409",
      country: "RO",
      county: "B",
      city: "Bucuresti",
      address: "MUNICIPIUL BUCUREŞTI, SECTOR 1, STR POPA SAVU, NR.78",
      phone: "",
      email: "office@refactura.ro",
      bank: "Unicredit",
      iban: "RO31BACX0000001999343001",
    };
  }

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId));

  let settings: any = {};
  if (tenant?.settings) {
    try {
      settings = JSON.parse(tenant.settings);
    } catch {
      // ignore
    }
  }

  return {
    name: tenant?.name || "TRADE INVEST NETWORK S.R.L.",
    cui: tenant?.cui ? tenant.cui.trim() : "RO42322117",
    regCom: settings.regCom || "J2020002825409",
    country: settings.country || "RO",
    county: settings.county || "B",
    city: settings.city || "Bucuresti",
    address: settings.address || tenant?.address || "Bucuresti",
    phone: tenant?.phone || "",
    email: tenant?.email || "",
    bank: settings.bank || "",
    iban: settings.iban || "",
  };
}

/**
 * Generează XML de Facturi (<Facturi>) conform specificațiilor oficiale SAGA C și SAGA Web API.
 * 
 * Regula SAGA:
 * - Dacă FurnizorCIF reprezintă CIF-ul societății -> import în Ieșiri (Facturi Emise/Vânzări)
 * - Dacă ClientCIF reprezintă CIF-ul societății -> import în Intrări (Achiziții/NIR)
 */
export async function generateSagaExportXML(tenantId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");

  const company = await getTenantCompanyProfile(tenantId);

  // Format dates for filtering (month === 0 means entire year)
  const isAllYear = !month || month === 0;
  const startDateStr = isAllYear ? `${year}-01-01` : `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = isAllYear ? 31 : new Date(year, month, 0).getDate();
  const endDateStr = isAllYear ? `${year}-12-31` : `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n`;
  xml += `<Facturi>\n`;

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Export Ieșiri (Facturi Emise -> vânzări către clienți)
  // ───────────────────────────────────────────────────────────────────────────
  const invoices = await db
    .select()
    .from(schema.emittedInvoices)
    .where(eq(schema.emittedInvoices.tenantId, tenantId));

  const monthInvoices = invoices.filter((inv) => {
    if (!inv.issueDate) return false;
    const invDate = inv.issueDate.substring(0, 10);
    return invDate >= startDateStr && invDate <= endDateStr;
  });

  const allClients = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.tenantId, tenantId));
  const clientsMap = new Map();
  allClients.forEach((c) => clientsMap.set(c.id, c));

  for (const inv of monthInvoices) {
    const lines = await db
      .select()
      .from(schema.emittedInvoiceLines)
      .where(eq(schema.emittedInvoiceLines.emittedInvoiceId, inv.id));
    const client = clientsMap.get(inv.clientId);

    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    // Furnizorul suntem NOI
    xml += `      <FurnizorNume>${escapeXml(company.name)}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(company.cui)}</FurnizorCIF>\n`;
    if (company.regCom) xml += `      <FurnizorNrRegCom>${escapeXml(company.regCom)}</FurnizorNrRegCom>\n`;
    xml += `      <FurnizorTara>${escapeXml(company.country || "RO")}</FurnizorTara>\n`;
    if (company.county) xml += `      <FurnizorJudet>${escapeXml(company.county)}</FurnizorJudet>\n`;
    if (company.city) xml += `      <FurnizorLocalitate>${escapeXml(company.city)}</FurnizorLocalitate>\n`;
    if (company.address) xml += `      <FurnizorAdresa>${escapeXml(company.address)}</FurnizorAdresa>\n`;
    if (company.phone) xml += `      <FurnizorTelefon>${escapeXml(company.phone)}</FurnizorTelefon>\n`;
    if (company.email) xml += `      <FurnizorMail>${escapeXml(company.email)}</FurnizorMail>\n`;
    if (company.bank) xml += `      <FurnizorBanca>${escapeXml(company.bank)}</FurnizorBanca>\n`;
    if (company.iban) xml += `      <FurnizorIBAN>${escapeXml(company.iban)}</FurnizorIBAN>\n`;

    // Clientul
    xml += `      <ClientNume>${escapeXml(client?.name || "Client Necunoscut")}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(client?.cui || "")}</ClientCIF>\n`;
    if (client?.regCom) xml += `      <ClientNrRegCom>${escapeXml(client.regCom)}</ClientNrRegCom>\n`;
    if ((client as any)?.county) xml += `      <ClientJudet>${escapeXml((client as any).county)}</ClientJudet>\n`;
    xml += `      <ClientTara>RO</ClientTara>\n`;
    if (client?.city) xml += `      <ClientLocalitate>${escapeXml(client.city)}</ClientLocalitate>\n`;
    if (client?.address) xml += `      <ClientAdresa>${escapeXml(client.address)}</ClientAdresa>\n`;
    if ((client as any)?.bank) xml += `      <ClientBanca>${escapeXml((client as any).bank)}</ClientBanca>\n`;
    if ((client as any)?.iban) xml += `      <ClientIBAN>${escapeXml((client as any).iban)}</ClientIBAN>\n`;
    if (client?.phone) xml += `      <ClientTelefon>${escapeXml(client.phone)}</ClientTelefon>\n`;
    if (client?.email) xml += `      <ClientMail>${escapeXml(client.email)}</ClientMail>\n`;

    // Date factură
    xml += `      <FacturaNumar>${escapeXml(inv.number)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(inv.issueDate)}</FacturaData>\n`;
    if (inv.dueDate) {
      xml += `      <FacturaScadenta>${formatDate(inv.dueDate)}</FacturaScadenta>\n`;
    }
    xml += `      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>\n`;
    xml += `      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>\n`;
    xml += `      <FacturaTip></FacturaTip>\n`;
    xml += `      <FacturaMoneda>${escapeXml(inv.currency || "RON")}</FacturaMoneda>\n`;
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const line of lines) {
      const qty = parseFloat(String(line.quantity)) || 0;
      const price = parseFloat(String(line.unitPrice)) || 0;
      const rate = parseFloat(String(line.vatRate)) || 0;
      const lineVal = Math.round(qty * price * 100) / 100;
      const lineVat = Math.round(lineVal * (rate / 100) * 100) / 100;

      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      xml += `          <Descriere>${escapeXml(line.description)}</Descriere>\n`;
      if (line.devizCode) {
        xml += `          <CodArticolClient>${escapeXml(line.devizCode)}</CodArticolClient>\n`;
      }
      xml += `          <UM>${escapeXml(line.unit || "buc")}</UM>\n`;
      xml += `          <Cantitate>${qty}</Cantitate>\n`;
      xml += `          <Pret>${price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${rate}</ProcTVA>\n`;
      xml += `          <TVA>${lineVat.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>704</Cont>\n`;
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Export Intrări (Facturi Furnizori / NIR)
  // ───────────────────────────────────────────────────────────────────────────
  const nirList = await db
    .select()
    .from(schema.nir)
    .where(eq(schema.nir.tenantId, tenantId));
  const { sagaIntrari, sagaIntrariLinii, sagaArticles } = await import(
    "../modules/saga/schema"
  );
  const noileIntrari = await db
    .select()
    .from(sagaIntrari)
    .where(eq(sagaIntrari.tenantId, tenantId));

  const monthNirs = nirList.filter((n) => {
    if (!n.receiptDate) return false;
    const nDate = n.receiptDate.substring(0, 10);
    return nDate >= startDateStr && nDate <= endDateStr;
  });

  const monthSagaIntrari = noileIntrari.filter((n) => {
    if (!n.data) return false;
    const nDate = n.data.substring(0, 10);
    return nDate >= startDateStr && nDate <= endDateStr;
  });

  // a. Facturi Intrări din modulul NIR
  for (const n of monthNirs) {
    const linesData = await db
      .select({
        line: schema.nirLines,
        articleCode: sagaArticles.code,
      })
      .from(schema.nirLines)
      .leftJoin(
        sagaArticles,
        eq(schema.nirLines.sagaArticleId, sagaArticles.id)
      )
      .where(eq(schema.nirLines.nirId, n.id));

    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    // Furnizorul
    xml += `      <FurnizorNume>${escapeXml(n.supplierName || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.supplierCUI || "")}</FurnizorCIF>\n`;

    // Clientul suntem NOI
    xml += `      <ClientNume>${escapeXml(company.name)}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(company.cui)}</ClientCIF>\n`;
    if (company.regCom) xml += `      <ClientNrRegCom>${escapeXml(company.regCom)}</ClientNrRegCom>\n`;
    if (company.county) xml += `      <ClientJudet>${escapeXml(company.county)}</ClientJudet>\n`;
    xml += `      <ClientTara>${escapeXml(company.country || "RO")}</ClientTara>\n`;
    if (company.city) xml += `      <ClientLocalitate>${escapeXml(company.city)}</ClientLocalitate>\n`;
    if (company.address) xml += `      <ClientAdresa>${escapeXml(company.address)}</ClientAdresa>\n`;

    // Date document intrare
    xml += `      <FacturaNumar>${escapeXml(n.invoiceNumber || n.nirNumber)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(n.receiptDate)}</FacturaData>\n`;
    xml += `      <FacturaMoneda>RON</FacturaMoneda>\n`;
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const row of linesData) {
      const line = row.line;
      const code = row.articleCode;
      const qty = parseFloat(String(line.cantitateReceptionata)) || 0;
      const price = parseFloat(String(line.unitPrice)) || 0;
      const rate = parseFloat(String(line.vatRate)) || 0;
      const lineVal = Math.round(qty * price * 100) / 100;
      const lineVat = Math.round(lineVal * (rate / 100) * 100) / 100;

      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      if (n.gestiune) {
        xml += `          <Gestiune>${escapeXml(n.gestiune)}</Gestiune>\n`;
      }
      xml += `          <Descriere>${escapeXml(line.description)}</Descriere>\n`;
      if (code) {
        xml += `          <CodArticolFurnizor>${escapeXml(code)}</CodArticolFurnizor>\n`;
      }
      xml += `          <UM>${escapeXml(line.unit || "buc")}</UM>\n`;
      xml += `          <Cantitate>${qty}</Cantitate>\n`;
      xml += `          <Pret>${price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${rate}</ProcTVA>\n`;
      xml += `          <TVA>${lineVat.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>${escapeXml(line.accountingAccount || n.accountingAccount || "371")}</Cont>\n`;
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
  }

  // b. Facturi Intrări din modulul SAGA (sagaIntrari)
  for (const n of monthSagaIntrari) {
    const linesData = await db
      .select()
      .from(sagaIntrariLinii)
      .where(eq(sagaIntrariLinii.intrareId, n.id));

    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    // Furnizorul
    xml += `      <FurnizorNume>${escapeXml(n.numeFurnizor || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.cuiFurnizor || "")}</FurnizorCIF>\n`;

    // Clientul suntem NOI
    xml += `      <ClientNume>${escapeXml(company.name)}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(company.cui)}</ClientCIF>\n`;
    if (company.regCom) xml += `      <ClientNrRegCom>${escapeXml(company.regCom)}</ClientNrRegCom>\n`;
    if (company.county) xml += `      <ClientJudet>${escapeXml(company.county)}</ClientJudet>\n`;
    xml += `      <ClientTara>${escapeXml(company.country || "RO")}</ClientTara>\n`;
    if (company.city) xml += `      <ClientLocalitate>${escapeXml(company.city)}</ClientLocalitate>\n`;
    if (company.address) xml += `      <ClientAdresa>${escapeXml(company.address)}</ClientAdresa>\n`;

    // Date document
    xml += `      <FacturaNumar>${escapeXml(n.nrDoc || String(n.nrIntern || ""))}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(n.data)}</FacturaData>\n`;
    if (n.scadent) {
      xml += `      <FacturaScadenta>${formatDate(n.scadent)}</FacturaScadenta>\n`;
    }
    xml += `      <FacturaMoneda>RON</FacturaMoneda>\n`;
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const line of linesData) {
      const qty = parseFloat(String(line.cantitate)) || 0;
      const price = parseFloat(String(line.pretUnitar)) || 0;
      const rate = parseFloat(String(line.tvaPercent)) || 0;
      const lineVal = parseFloat(String(line.valoare)) || Math.round(qty * price * 100) / 100;
      const lineVat = parseFloat(String(line.tvaSuma)) || Math.round(lineVal * (rate / 100) * 100) / 100;

      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      xml += `          <Descriere>${escapeXml(line.denumire)}</Descriere>\n`;
      if (line.cod) {
        xml += `          <CodArticolFurnizor>${escapeXml(line.cod)}</CodArticolFurnizor>\n`;
      }
      xml += `          <UM>${escapeXml(line.um || "buc")}</UM>\n`;
      xml += `          <Cantitate>${qty}</Cantitate>\n`;
      xml += `          <Pret>${price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${rate}</ProcTVA>\n`;
      xml += `          <TVA>${lineVat.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>${escapeXml(line.cont || "371")}</Cont>\n`;
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
  }

  xml += `</Facturi>\n`;
  return xml;
}

/**
 * Generează fișierul XML de Articole (<Articole>) conform specificațiilor SAGA (ART_<data>.xml)
 */
export async function generateSagaArticlesXML(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");

  const { sagaArticles } = await import("../modules/saga/schema");
  const articles = await db
    .select()
    .from(sagaArticles)
    .where(eq(sagaArticles.tenantId, tenantId));

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n`;
  xml += `<Articole>\n`;

  for (const art of articles) {
    xml += `  <Linie>\n`;
    xml += `    <Cod>${escapeXml(art.code)}</Cod>\n`;
    xml += `    <Denumire>${escapeXml(art.name)}</Denumire>\n`;
    xml += `    <UM>${escapeXml(art.unit || "buc")}</UM>\n`;
    xml += `    <Tip>${escapeXml(art.category || "Marfuri")}</Tip>\n`;
    xml += `    <TVA>${art.vatRate || "19"}</TVA>\n`;
    if (art.barcode) {
      xml += `    <Cod_bare>${escapeXml(art.barcode)}</Cod_bare>\n`;
    }
    xml += `  </Linie>\n`;
  }

  xml += `</Articole>\n`;
  return xml;
}

/**
 * Generează fișierul XML de Clienți (<Clienti>) conform specificațiilor SAGA (CLI_<data>.xml)
 */
export async function generateSagaClientsXML(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");

  const clientsList = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.tenantId, tenantId));

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n`;
  xml += `<Clienti>\n`;

  for (const client of clientsList) {
    xml += `  <Linie>\n`;
    xml += `    <Cod>${client.id}</Cod>\n`;
    xml += `    <Denumire>${escapeXml(client.name)}</Denumire>\n`;
    xml += `    <Cod_fiscal>${escapeXml(client.cui || "")}</Cod_fiscal>\n`;
    if (client.regCom) xml += `    <Reg_com>${escapeXml(client.regCom)}</Reg_com>\n`;
    xml += `    <Tara>RO</Tara>\n`;
    if ((client as any).county) xml += `    <Judet>${escapeXml((client as any).county)}</Judet>\n`;
    if (client.city) xml += `    <Localitate>${escapeXml(client.city)}</Localitate>\n`;
    if (client.address) xml += `    <Adresa>${escapeXml(client.address)}</Adresa>\n`;
    if ((client as any).iban) xml += `    <Cont_banca>${escapeXml((client as any).iban)}</Cont_banca>\n`;
    if ((client as any).bank) xml += `    <Banca>${escapeXml((client as any).bank)}</Banca>\n`;
    if (client.phone) xml += `    <Tel>${escapeXml(client.phone)}</Tel>\n`;
    if (client.email) xml += `    <Email>${escapeXml(client.email)}</Email>\n`;
    xml += `  </Linie>\n`;
  }

  xml += `</Clienti>\n`;
  return xml;
}

/**
 * Actualizează tokenul SAGA Web în setările tenantului când se primește un nou refresh token
 */
export async function updateTenantSagaToken(tenantId: number, newToken: string) {
  const db = await getDb();
  if (!db) return;
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId));
  if (!tenant) return;

  let settings: any = {};
  if (tenant.settings) {
    try {
      settings = JSON.parse(tenant.settings);
    } catch {
      settings = {};
    }
  }
  settings.sagaWebToken = newToken;
  await db
    .update(schema.tenants)
    .set({ settings: JSON.stringify(settings) })
    .where(eq(schema.tenants.id, tenantId));
}

function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return "";
  const str = String(unsafe);
  return str.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "dd.MM.yyyy");
  } catch {
    return String(dateStr);
  }
}

