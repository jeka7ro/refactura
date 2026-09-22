/**
 * SAGA Invoice Importer
 * Suportă importul facturilor externe (Ieșiri valută / Vânzări externe) generate în SAGA:
 * 1. Format SAGA XML (<Facturi><Factura><Antet>...<Detalii>...)
 * 2. Format SAGA Excel / XLSX / CSV
 */
import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";

export interface ParsedSagaInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  vatRate: number;
  total: number;
  vatAmount?: number;
}

export interface ParsedSagaInvoice {
  series: string;
  number: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string;  // YYYY-MM-DD
  currency: string;
  exchangeRate?: number;
  subtotal: number;
  totalVAT: number;
  total: number;
  clientName: string;
  clientCUI?: string;
  clientCountry?: string;
  clientAddress?: string;
  clientCity?: string;
  clientRegCom?: string;
  notes?: string;
  lines: ParsedSagaInvoiceLine[];
}

/**
 * Normalizează o dată din format DD.MM.YYYY sau YYYY-MM-DD în format YYYY-MM-DD
 */
function normalizeDate(raw: any): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  if (raw instanceof Date) return raw.toISOString().split("T")[0];
  const str = String(raw).trim();
  
  // Format DD.MM.YYYY sau DD/MM/YYYY
  const roMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (roMatch) {
    const day = roMatch[1].padStart(2, "0");
    const month = roMatch[2].padStart(2, "0");
    const year = roMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Parsează XML-ul standard exportat din SAGA (<Facturi>)
 */
export function parseSagaXmlInvoices(buffer: Buffer): ParsedSagaInvoice[] {
  // SAGA folosește frecvent Windows-1250 sau UTF-8
  let xmlString = buffer.toString("utf-8");
  if (xmlString.includes("encoding=\"Windows-1250\"") || xmlString.includes("encoding='Windows-1250'")) {
    try {
      // Încercare decodare latin1 dacă are caractere speciale non-utf8
      const latin1 = buffer.toString("latin1");
      if (!latin1.includes("")) {
        xmlString = latin1;
      }
    } catch {
      // fallback la utf-8
    }
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  const parsed = parser.parse(xmlString);
  const facturiRoot = parsed.Facturi || parsed.facturi;
  if (!facturiRoot) {
    throw new Error("Fișierul XML nu conține tag-ul rădăcină <Facturi> specific SAGA.");
  }

  let rawFacturi = facturiRoot.Factura || facturiRoot.factura || [];
  if (!Array.isArray(rawFacturi)) {
    rawFacturi = [rawFacturi];
  }

  const invoices: ParsedSagaInvoice[] = [];

  for (const item of rawFacturi) {
    const antet = item.Antet || item.antet || {};
    const detalii = item.Detalii || item.detalii || {};
    let linii = detalii.Linie || detalii.linie || [];
    if (!Array.isArray(linii)) {
      linii = linii ? [linii] : [];
    }

    // Detalii antet
    const rawNumber = String(antet.FacturaNumar || antet.Numar || "").trim();
    const rawSerie = String(antet.FacturaSerie || antet.Serie || "").trim();
    
    // Extragere serie și număr dacă sunt combinate
    let series = rawSerie || "EXT";
    let number = rawNumber;
    if (!series && rawNumber.match(/^([A-Za-z]+)\s*(\d+)$/)) {
      const m = rawNumber.match(/^([A-Za-z]+)\s*(\d+)$/)!;
      series = m[1];
      number = m[2];
    }

    const issueDate = normalizeDate(antet.FacturaData || antet.Data);
    const dueDate = antet.FacturaScadenta || antet.Scadenta ? normalizeDate(antet.FacturaScadenta || antet.Scadenta) : undefined;
    const currency = String(antet.FacturaMoneda || antet.Moneda || antet.Valuta || "EUR").trim().toUpperCase();
    const exchangeRate = parseFloat(antet.FacturaCurs || antet.Curs || "1") || 1;

    // Client
    const clientName = String(antet.ClientNume || antet.NumeClient || antet.Client || "").trim();
    const clientCUI = String(antet.ClientCIF || antet.CodFiscal || antet.CUI || "").trim().toUpperCase();
    
    // Țară client
    let clientCountry = String(antet.ClientTara || antet.Tara || "").trim().toUpperCase();
    if (!clientCountry && clientCUI) {
      const matchCountry = clientCUI.match(/^([A-Za-z]{2})/);
      if (matchCountry) clientCountry = matchCountry[1].toUpperCase();
    }
    if (!clientCountry) clientCountry = "UE";

    const clientAddress = String(antet.ClientAdresa || antet.Adresa || "").trim();
    const clientCity = String(antet.ClientLocalitate || antet.Localitate || antet.ClientJudet || "").trim();
    const clientRegCom = String(antet.ClientNrRegCom || antet.NrRegCom || "").trim();
    const notes = String(antet.Observatii || antet.FacturaObservatii || "").trim();

    // Linii factură
    const lines: ParsedSagaInvoiceLine[] = [];
    let calcSubtotal = 0;
    let calcVat = 0;

    for (const l of linii) {
      const desc = String(l.Descriere || l.Denumire || l.DenumireArticol || "Articol").trim();
      const qty = parseFloat(l.Cantitate || "1") || 1;
      const price = parseFloat(l.PretUnitar || l.Pret || "0") || 0;
      const valoare = parseFloat(l.Valoare || (qty * price).toFixed(2)) || (qty * price);
      const cota = parseFloat(l.CotaTVA || "0") || 0;
      const tva = parseFloat(l.TVA || (valoare * cota / 100).toFixed(2)) || 0;
      const um = String(l.UM || "buc").trim();

      calcSubtotal += valoare;
      calcVat += tva;

      lines.push({
        description: desc,
        quantity: qty,
        unitPrice: price,
        unit: um,
        vatRate: cota,
        total: valoare + tva,
        vatAmount: tva,
      });
    }

    const subtotal = parseFloat(antet.FacturaValoare || antet.Valoare || calcSubtotal.toFixed(2)) || calcSubtotal;
    const totalVAT = parseFloat(antet.FacturaTVA || antet.TVA || calcVat.toFixed(2)) || calcVat;
    const total = parseFloat(antet.FacturaTotal || antet.Total || (subtotal + totalVAT).toFixed(2)) || (subtotal + totalVAT);

    invoices.push({
      series,
      number: number || `SAGA-${invoices.length + 1}`,
      issueDate,
      dueDate,
      currency,
      exchangeRate,
      subtotal,
      totalVAT,
      total,
      clientName: clientName || "Client Extern SAGA",
      clientCUI,
      clientCountry,
      clientAddress,
      clientCity,
      clientRegCom,
      notes,
      lines: lines.length > 0 ? lines : [{
        description: "Servicii / Produse externe conform export SAGA",
        quantity: 1,
        unitPrice: subtotal,
        unit: "buc",
        vatRate: totalVAT > 0 ? 19 : 0,
        total,
        vatAmount: totalVAT,
      }],
    });
  }

  return invoices;
}

/**
 * Parsează un fișier XLSX exportat din SAGA (Ieșiri valută)
 */
export function parseSagaXlsxInvoices(buffer: Buffer): ParsedSagaInvoice[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows || rows.length === 0) {
    throw new Error("Fișierul Excel nu conține date.");
  }

  const invoices: ParsedSagaInvoice[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];

    // Căutare câmpuri flexibilă după diverse denumiri din rapoartele SAGA
    const rawNumber = String(row["Nr. doc"] || row["Nr doc"] || row["Numar"] || row["NUMAR"] || row["Nr. Factura"] || "").trim();
    if (!rawNumber) continue;

    const rawDate = row["Data"] || row["DATA"] || row["Data doc"] || row["Data factura"];
    const issueDate = normalizeDate(rawDate);
    const dueDate = row["Scadent"] || row["Data scadenta"] ? normalizeDate(row["Scadent"] || row["Data scadenta"]) : undefined;

    const clientName = String(row["Client"] || row["Denumire client"] || row["Partener"] || row["DENUMIRE"] || "").trim();
    const clientCUI = String(row["Cod fiscal"] || row["CIF"] || row["CUI"] || row["COD_FISCAL"] || "").trim().toUpperCase();
    
    let clientCountry = String(row["Tara"] || row["Cod tara"] || "").trim().toUpperCase();
    if (!clientCountry && clientCUI) {
      const matchCountry = clientCUI.match(/^([A-Za-z]{2})/);
      if (matchCountry) clientCountry = matchCountry[1].toUpperCase();
    }
    if (!clientCountry) clientCountry = "UE";

    const currency = String(row["Valuta"] || row["Moneda"] || row["VALUTA"] || "EUR").trim().toUpperCase();
    const exchangeRate = parseFloat(row["Curs"] || row["CURS"] || "1") || 1;

    const totalValuta = parseFloat(row["Total valuta"] || row["Total"] || row["TOTAL"] || row["Valoare"] || "0") || 0;
    const tvaValuta = parseFloat(row["TVA valuta"] || row["TVA"] || "0") || 0;
    const subtotal = totalValuta - tvaValuta > 0 ? totalValuta - tvaValuta : totalValuta;

    const descriere = String(row["Explicatie"] || row["Articol"] || row["Denumire articol"] || `Factură externă ${rawNumber}`).trim();

    invoices.push({
      series: "EXT",
      number: rawNumber,
      issueDate,
      dueDate,
      currency,
      exchangeRate,
      subtotal,
      totalVAT: tvaValuta,
      total: totalValuta,
      clientName: clientName || `Client ${clientCUI || rawNumber}`,
      clientCUI,
      clientCountry,
      clientAddress: String(row["Adresa"] || "").trim(),
      clientCity: String(row["Localitate"] || row["Oras"] || "").trim(),
      notes: "Importat din SAGA (Ieșiri valută)",
      lines: [{
        description: descriere,
        quantity: 1,
        unitPrice: subtotal,
        unit: "buc",
        vatRate: tvaValuta > 0 ? 19 : 0,
        total: totalValuta,
        vatAmount: tvaValuta,
      }],
    });
  }

  return invoices;
}

/**
 * Salvează facturile extrase în baza de date (tabelul emittedInvoices + emittedInvoiceLines)
 */
export async function saveSagaInvoicesToDb(tenantId: number, invoices: ParsedSagaInvoice[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  let imported = 0;
  let skipped = 0;
  const createdIds: number[] = [];

  for (const inv of invoices) {
    // Verificăm dacă factura există deja pentru a evita duplicatele
    const [existing] = await db
      .select({ id: schema.emittedInvoices.id })
      .from(schema.emittedInvoices)
      .where(
        and(
          eq(schema.emittedInvoices.tenantId, tenantId),
          eq(schema.emittedInvoices.series, inv.series),
          eq(schema.emittedInvoices.number, inv.number)
        )
      );

    if (existing) {
      skipped++;
      continue;
    }

    // Găsire sau inserare client în nomenclatorul de clienți
    let clientId: number | undefined;
    if (inv.clientCUI || inv.clientName) {
      const [existingClient] = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.tenantId, tenantId),
            inv.clientCUI
              ? eq(schema.clients.cui, inv.clientCUI)
              : eq(schema.clients.name, inv.clientName)
          )
        );

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const [insertedClient] = await db.insert(schema.clients).values({
          tenantId,
          name: inv.clientName,
          cui: inv.clientCUI || null,
          regCom: inv.clientRegCom || null,
          address: inv.clientAddress || null,
          city: inv.clientCity || null,
          country: inv.clientCountry || "UE",
          currency: inv.currency || "EUR",
          tva: 0,
          isActive: 1,
        });
        clientId = insertedClient.insertId;
      }
    }

    // Inserare factură emisă
    const [insertResult] = await db.insert(schema.emittedInvoices).values({
      tenantId,
      series: inv.series,
      number: inv.number,
      clientId: clientId || null,
      clientName: inv.clientName,
      clientCUI: inv.clientCUI || null,
      clientRegCom: inv.clientRegCom || null,
      clientAddress: inv.clientAddress || null,
      clientCity: inv.clientCity || null,
      clientCountry: (inv.clientCountry || "UE").slice(0, 2).toUpperCase(),
      issueDate: inv.issueDate,
      dueDate: inv.dueDate || null,
      subtotal: String(inv.subtotal.toFixed(2)),
      totalVAT: String(inv.totalVAT.toFixed(2)),
      total: String(inv.total.toFixed(2)),
      currency: inv.currency,
      status: "sent",
      spvStatus: "extern", // Factură externă - raportată în 390 VIES, nu în RO e-Factura
      notes: inv.notes || "Factură externă importată din SAGA",
    });

    const emittedInvoiceId = insertResult.insertId;
    createdIds.push(emittedInvoiceId);

    // Inserare linii
    for (let i = 0; i < inv.lines.length; i++) {
      const line = inv.lines[i];
      await db.insert(schema.emittedInvoiceLines).values({
        emittedInvoiceId,
        description: line.description,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice.toFixed(2)),
        unit: line.unit || "buc",
        vatRate: String(line.vatRate.toFixed(2)),
        total: String(line.total.toFixed(2)),
        lineOrder: i,
      });
    }

    imported++;
  }

  return { imported, skipped, total: invoices.length, createdIds };
}
