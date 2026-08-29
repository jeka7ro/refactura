import { eq, inArray, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { format } from "date-fns";
import * as schema from "../drizzle/schema";

export async function generateSagaExportXML(tenantId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");

  // Format dates for filtering
  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n`;
  xml += `<Facturi>\n`;

  // 1. Export Ieșiri (Facturi Emise -> vânzări)
  const invoices = await db.select().from(schema.emittedInvoices).where(
    eq(schema.emittedInvoices.tenantId, tenantId)
  );

  const monthInvoices = invoices.filter(inv => {
    if (!inv.issueDate) return false;
    const invDate = inv.issueDate.substring(0, 10);
    return invDate >= startDateStr && invDate <= endDateStr;
  });

  const allClients = await db.select().from(schema.clients).where(eq(schema.clients.tenantId, tenantId));
  const clientsMap = new Map();
  allClients.forEach(c => clientsMap.set(c.id, c));

  for (const inv of monthInvoices) {
    const lines = await db.select().from(schema.emittedInvoiceLines).where(eq(schema.emittedInvoiceLines.emittedInvoiceId, inv.id));
    const client = clientsMap.get(inv.clientId);
    
    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    xml += `      <ClientNume>${client ? escapeXml(client.name) : "Client Necunoscut"}</ClientNume>\n`;
    xml += `      <ClientCIF>${client && client.cui ? escapeXml(client.cui) : ""}</ClientCIF>\n`;
    xml += `      <FacturaNumar>${escapeXml(inv.number)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(inv.issueDate)}</FacturaData>\n`;
    xml += `      <FacturaScadenta>${inv.dueDate ? formatDate(inv.dueDate) : ""}</FacturaScadenta>\n`;
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;
    for (const line of lines) {
      xml += `        <Linie>\n`;
      xml += `          <Descriere>${escapeXml(line.description)}</Descriere>\n`;
      xml += `          <UM>${escapeXml(line.unit || "buc")}</UM>\n`;
      xml += `          <Cantitate>${line.quantity}</Cantitate>\n`;
      xml += `          <Pret>${line.unitPrice}</Pret>\n`;
      xml += `          <TVA>${line.vatAmount || 0}</TVA>\n`;
      xml += `          <ProcTVA>${line.vatRate || 0}</ProcTVA>\n`;
      xml += `          <Cont>704</Cont>\n`; 
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
  }

  // 2. Export Intrări (Facturi Furnizori / NIR)
  const nirList = await db.select().from(schema.nir).where(eq(schema.nir.tenantId, tenantId));
  const { sagaIntrari, sagaIntrariLinii, sagaArticles } = await import("../modules/saga/schema");
  const noileIntrari = await db.select().from(sagaIntrari).where(eq(sagaIntrari.tenantId, tenantId));

  const monthNirs = nirList.filter(n => {
    if (!n.receiptDate) return false;
    const nDate = n.receiptDate.substring(0, 10);
    return nDate >= startDateStr && nDate <= endDateStr;
  });

  const monthSagaIntrari = noileIntrari.filter(n => {
    if (!n.data) return false;
    const nDate = n.data.substring(0, 10);
    return nDate >= startDateStr && nDate <= endDateStr;
  });

  // a. Facturi Intrari (din modulul vechi NIR)
  for (const n of monthNirs) {
    const linesData = await db
      .select({
        line: schema.nirLines,
        articleCode: sagaArticles.code,
      })
      .from(schema.nirLines)
      .leftJoin(sagaArticles, eq(schema.nirLines.sagaArticleId, sagaArticles.id))
      .where(eq(schema.nirLines.nirId, n.id));
    
    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    xml += `      <FurnizorNume>${escapeXml(n.supplierName || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.supplierCUI || "")}</FurnizorCIF>\n`;
    xml += `      <FacturaNumar>${escapeXml(n.invoiceNumber || n.nirNumber)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(n.receiptDate)}</FacturaData>\n`;
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;
    for (const row of linesData) {
      const line = row.line;
      const code = row.articleCode;
      xml += `        <Linie>\n`;
      if (code) {
        xml += `          <CodArticolFurnizor>${escapeXml(code)}</CodArticolFurnizor>\n`;
      }
      xml += `          <Gestiune>${escapeXml(n.gestiune || "")}</Gestiune>\n`;
      xml += `          <Descriere>${escapeXml(line.description)}</Descriere>\n`;
      xml += `          <UM>${escapeXml(line.unit || "buc")}</UM>\n`;
      xml += `          <Cantitate>${line.cantitateReceptionata}</Cantitate>\n`;
      xml += `          <Pret>${line.unitPrice || 0}</Pret>\n`;
      xml += `          <ProcTVA>${line.vatRate || 0}</ProcTVA>\n`;
      xml += `          <Cont>${escapeXml(line.accountingAccount || n.accountingAccount || "371")}</Cont>\n`; 
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
  }

  // b. Facturi Intrari (din modulul nou SAGA)
  for (const n of monthSagaIntrari) {
    const linesData = await db
      .select()
      .from(sagaIntrariLinii)
      .where(eq(sagaIntrariLinii.intrareId, n.id));
    
    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    xml += `      <FurnizorNume>${escapeXml(n.numeFurnizor || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.cuiFurnizor || "")}</FurnizorCIF>\n`;
    xml += `      <FacturaNumar>${escapeXml(n.nrDoc || String(n.nrIntern || ""))}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(n.data)}</FacturaData>\n`;
    xml += `      <FacturaScadenta>${n.scadent ? formatDate(n.scadent) : ""}</FacturaScadenta>\n`;
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;
    for (const line of linesData) {
      xml += `        <Linie>\n`;
      if (line.cod) {
        xml += `          <CodArticolFurnizor>${escapeXml(line.cod)}</CodArticolFurnizor>\n`;
      }
      xml += `          <Descriere>${escapeXml(line.denumire)}</Descriere>\n`;
      xml += `          <UM>${escapeXml(line.um || "buc")}</UM>\n`;
      xml += `          <Cantitate>${line.cantitate}</Cantitate>\n`;
      xml += `          <Pret>${line.pretUnitar || 0}</Pret>\n`;
      xml += `          <ProcTVA>${line.tvaPercent || 0}</ProcTVA>\n`;
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

function escapeXml(unsafe: string) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return format(d, "dd-MM-yyyy");
  } catch (e) {
    return dateStr;
  }
}

