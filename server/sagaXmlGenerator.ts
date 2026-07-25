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
  xml += `<ExportSaga>\n`;

  // 1. Export Clienți
  const clientsList = await db.select().from(schema.clients).where(eq(schema.clients.tenantId, tenantId));
  
  if (clientsList.length > 0) {
    xml += `  <Clienti>\n`;
    for (const client of clientsList) {
      xml += `    <Client>\n`;
      xml += `      <Cod>${client.id}</Cod>\n`;
      xml += `      <Denumire>${escapeXml(client.name)}</Denumire>\n`;
      xml += `      <CodFiscal>${client.cui ? escapeXml(client.cui) : ""}</CodFiscal>\n`;
      xml += `      <RegCom>${client.regCom ? escapeXml(client.regCom) : ""}</RegCom>\n`;
      xml += `      <Adresa>${client.address ? escapeXml(client.address) : ""}</Adresa>\n`;
      xml += `      <Banca></Banca>\n`;
      xml += `      <ContBanca></ContBanca>\n`;
      xml += `    </Client>\n`;
    }
    xml += `  </Clienti>\n`;
  }

  // 2. Export Ieșiri (Facturi Emise)
  const invoices = await db.select().from(schema.emittedInvoices).where(
    eq(schema.emittedInvoices.tenantId, tenantId)
  );

  const monthInvoices = invoices.filter(inv => {
    if (!inv.issueDate) return false;
    const invDate = inv.issueDate.substring(0, 10);
    return invDate >= startDateStr && invDate <= endDateStr;
  });

  if (monthInvoices.length > 0) {
    xml += `  <Iesiri>\n`;
    for (const inv of monthInvoices) {
      const lines = await db.select().from(schema.emittedInvoiceLines).where(eq(schema.emittedInvoiceLines.emittedInvoiceId, inv.id));
      
      xml += `    <Iesire>\n`;
      xml += `      <NrDoc>${escapeXml(inv.number)}</NrDoc>\n`;
      xml += `      <Data>${formatDate(inv.issueDate)}</Data>\n`;
      xml += `      <CodClient>${inv.clientId || ""}</CodClient>\n`;
      xml += `      <Scadenta>${inv.dueDate ? formatDate(inv.dueDate) : ""}</Scadenta>\n`;
      
      xml += `      <Detalii>\n`;
      for (const line of lines) {
        xml += `        <Detaliu>\n`;
        xml += `          <Denumire>${escapeXml(line.description)}</Denumire>\n`;
        xml += `          <UM>${escapeXml(line.unit || "buc")}</UM>\n`;
        xml += `          <Cantitate>${line.quantity}</Cantitate>\n`;
        xml += `          <Pret>${line.unitPrice}</Pret>\n`;
        xml += `          <CotaTVA>${line.vatRate}</CotaTVA>\n`;
        xml += `          <Cont>704</Cont>\n`; 
        xml += `        </Detaliu>\n`;
      }
      xml += `      </Detalii>\n`;
      xml += `    </Iesire>\n`;
    }
    xml += `  </Iesiri>\n`;
  }

  // 3. Export Intrări (NIR / Facturi Furnizori)
  const nirList = await db.select().from(schema.nir).where(eq(schema.nir.tenantId, tenantId));
  const monthNirs = nirList.filter(n => {
    if (!n.receiptDate) return false;
    const nDate = n.receiptDate.substring(0, 10);
    return nDate >= startDateStr && nDate <= endDateStr;
  });

  if (monthNirs.length > 0) {
    xml += `  <Intrari>\n`;
    for (const n of monthNirs) {
      const lines = await db.select().from(schema.nirLines).where(eq(schema.nirLines.nirId, n.id));
      
      xml += `    <Intrare>\n`;
      xml += `      <NrDoc>${escapeXml(n.invoiceNumber || n.nirNumber)}</NrDoc>\n`;
      xml += `      <Data>${formatDate(n.receiptDate)}</Data>\n`;
      xml += `      <Furnizor>${escapeXml(n.supplierName || "")}</Furnizor>\n`;
      xml += `      <CUIFurnizor>${escapeXml(n.supplierCUI || "")}</CUIFurnizor>\n`;
      xml += `      <Gestiune>${escapeXml(n.gestiune || "")}</Gestiune>\n`;
      
      xml += `      <Detalii>\n`;
      for (const line of lines) {
        xml += `        <Detaliu>\n`;
        xml += `          <Denumire>${escapeXml(line.description)}</Denumire>\n`;
        xml += `          <UM>${escapeXml(line.unit || "buc")}</UM>\n`;
        xml += `          <Cantitate>${line.cantitateReceptionata}</Cantitate>\n`;
        xml += `          <Pret>${line.unitPrice || 0}</Pret>\n`;
        xml += `          <CotaTVA>${line.vatRate || 0}</CotaTVA>\n`;
        xml += `          <Cont>371</Cont>\n`; 
        xml += `        </Detaliu>\n`;
      }
      xml += `      </Detalii>\n`;
      xml += `    </Intrare>\n`;
    }
    xml += `  </Intrari>\n`;
  }

  xml += `</ExportSaga>\n`;
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
