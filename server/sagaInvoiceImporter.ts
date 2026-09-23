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
  clientCode?: string;
  clientCUI?: string;
  clientCountry?: string;
  clientAddress?: string;
  clientCity?: string;
  clientRegCom?: string;
  notes?: string;
  status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
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

  // 1. Format SAGA Visual FoxPro XML (<VFPData><c_xml>...</c_xml></VFPData>)
  if (parsed.VFPData) {
    let rows = parsed.VFPData.c_xml || [];
    if (!Array.isArray(rows)) {
      rows = rows ? [rows] : [];
    }

    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const invId = String(r.id_iesire || r.nr_iesire || "").trim();
      if (!groups.has(invId)) {
        groups.set(invId, []);
      }
      groups.get(invId)!.push(r);
    }

    const invoices: ParsedSagaInvoice[] = [];

    for (const [, items] of groups.entries()) {
      if (items.length === 0) continue;
      const head = items[0];
      const fullNum = String(head.nr_iesire || "").trim();
      let series = "EXT";
      let number = fullNum;
      const match = fullNum.match(/^([A-Za-z]+)\s*(.*)$/);
      if (match) {
        series = match[1].toUpperCase();
        number = fullNum;
      } else {
        series = "EXT";
        number = fullNum;
      }

      const clientName = String(head.denumire || "").trim() || "Client Extern";
      const clientCode = head.cod !== undefined && head.cod !== null ? String(head.cod).padStart(5, "0") : undefined;
      const currency = String(head.cod_valuta || "EUR").trim().toUpperCase();
      const exchangeRate = parseFloat(String(head.curs || "1")) || 1;
      const issueDate = normalizeDate(head.data);
      const dueDate = head.scadent ? normalizeDate(head.scadent) : undefined;
      const isPaid = parseFloat(String(head.neachitat || "0")) === 0;

      // Deduct country from name or default to UE
      let clientCountry = "UE";
      const upperName = clientName.toUpperCase();
      if (/\b(SAS|SASU|SARL|EURL)\b/.test(upperName)) {
        clientCountry = "FR";
      } else if (/\b(BVBA|SPRL)\b/.test(upperName)) {
        clientCountry = "BE";
      } else if (/\b(GMBH|AG)\b/.test(upperName)) {
        clientCountry = "DE";
      } else if (/\b(SNC)\b/.test(upperName)) {
        clientCountry = "IT";
      }

      const lines: ParsedSagaInvoiceLine[] = [];
      let subtotal = 0;
      let totalVAT = 0;

      for (const it of items) {
        const desc = String(it.denumire1 || it.denumire2 || "Articol").trim();
        const qty = parseFloat(String(it.cantitate || it.cantitate1 || "1")) || 1;
        const puVal = parseFloat(String(it.pu_val || it.pu_val1 || "0")) || 0;
        const lineTotal = parseFloat(String(it.val_val1 || it.val_val2 || (qty * puVal) || "0")) || 0;
        const vatRate = parseFloat(String(it.tva_art || it.tva_art1 || "0")) || 0;
        const vatVal = parseFloat(String(it.tva_val1 || it.tva_val2 || "0")) || 0;

        subtotal += lineTotal;
        totalVAT += vatVal;

        lines.push({
          description: desc,
          quantity: qty,
          unitPrice: puVal,
          unit: String(it.um || it.um1 || "buc").trim() || "buc",
          vatRate,
          total: lineTotal,
          vatAmount: vatVal,
        });
      }

      const total = subtotal + totalVAT;

      invoices.push({
        series,
        number,
        issueDate,
        dueDate,
        currency,
        exchangeRate,
        subtotal,
        totalVAT,
        total,
        clientName,
        clientCode,
        clientCountry,
        notes: head.inf_suplm ? String(head.inf_suplm).trim() : `Factură externă importată din SAGA (${currency} la curs ${exchangeRate})`,
        status: isPaid ? "paid" : "sent",
        lines: lines.length > 0 ? lines : [{
          description: "Servicii / Produse externe conform export SAGA",
          quantity: 1,
          unitPrice: subtotal,
          unit: "buc",
          vatRate: 0,
          total,
          vatAmount: 0,
        }],
      });
    }

    return invoices;
  }

  // 2. Format SAGA XML clasic (<Facturi><Factura>...</Facturi>)
  const facturiRoot = parsed.Facturi || parsed.facturi;
  if (!facturiRoot) {
    throw new Error("Fișierul XML nu conține un format recunoscut de export SAGA (<Facturi> sau <VFPData>).");
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
    const currency = String(antet.FacturaMoneda || antet.Moneda || antet.Valuta || "").trim().toUpperCase() || "RON";
    const exchangeRate = parseFloat(antet.FacturaCurs || antet.Curs || "1") || 1;

    // Client
    const clientName = String(antet.ClientNume || antet.NumeClient || antet.Client || "").trim();
    const clientCUI = String(antet.ClientCIF || antet.CodFiscal || antet.CUI || "").trim().toUpperCase();
    
    // Țară client
    let clientCountry = String(antet.ClientTara || antet.Tara || "").trim().toUpperCase();
    if (!clientCountry && clientCUI) {
      const matchCountry = clientCUI.match(/^([A-Za-z]{2})/);
      if (matchCountry) {
        clientCountry = matchCountry[1].toUpperCase();
      } else if (/^\d+$/.test(clientCUI)) {
        clientCountry = "RO";
      }
    }
    if (clientCountry === "ROMANIA" || clientCountry === "ROMÂNIA" || clientCountry === "ROU") {
      clientCountry = "RO";
    }
    if (!clientCountry) {
      clientCountry = currency !== "RON" ? "UE" : "RO";
    }

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
      if (matchCountry) {
        clientCountry = matchCountry[1].toUpperCase();
      } else if (/^\d+$/.test(clientCUI)) {
        clientCountry = "RO";
      }
    }
    if (clientCountry === "ROMANIA" || clientCountry === "ROMÂNIA" || clientCountry === "ROU") {
      clientCountry = "RO";
    }
    if (!clientCountry) {
      clientCountry = "UE";
    }

    const currency = String(row["Valuta"] || row["Moneda"] || row["VALUTA"] || "").trim().toUpperCase() || "EUR";
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
 * Determină dacă o factură este EXTERNĂ (în valută sau către partener străin).
 * Facturile din România se preiau automat prin SPV e-Factura și sunt ignorate la importul din SAGA.
 */
export function isExternalSagaInvoice(inv: {
  currency?: string;
  clientCountry?: string;
  clientCUI?: string;
}): boolean {
  const curr = (inv.currency || "RON").trim().toUpperCase();
  const country = (inv.clientCountry || "").trim().toUpperCase();
  const cui = (inv.clientCUI || "").trim().toUpperCase();

  // 1. Dacă valuta este diferită de RON (ex: EUR, USD, GBP, CHF), este cert factură externă
  if (curr && curr !== "RON") {
    return true;
  }

  // 2. Dacă țara este specificată și NU este România (RO, ROMANIA, ROU)
  if (country && country !== "RO" && country !== "ROMANIA" && country !== "ROMÂNIA" && country !== "ROU") {
    return true;
  }

  // 3. Dacă CUI-ul are prefix de altă țară UE/non-UE (ex: DE123456, FR123456, BG123456, etc.)
  if (cui && /^[A-Z]{2}/.test(cui) && !cui.startsWith("RO")) {
    return true;
  }

  // Altfel este factură internă de România
  return false;
}

/**
 * Salvează facturile extrase în baza de date (tabelul emittedInvoices + emittedInvoiceLines)
 * Notă: Se importă EXCLUSIV facturile externe. Facturile din România sunt ignorate automat.
 */
export async function saveSagaInvoicesToDb(tenantId: number, invoices: ParsedSagaInvoice[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  let imported = 0;
  let skippedDuplicates = 0;
  let skippedRo = 0;
  const createdIds: number[] = [];

  for (const inv of invoices) {
    // 1. Filtrare strictă: facturile din România se preiau automat prin SPV e-Factura
    if (!isExternalSagaInvoice(inv)) {
      skippedRo++;
      continue;
    }

    // 2. Verificăm dacă factura există deja pentru a evita duplicatele
    const [existing] = await db
      .select({ id: schema.emittedInvoices.id })
      .from(schema.emittedInvoices)
      .where(
        and(
          eq(schema.emittedInvoices.tenantId, tenantId),
          eq(schema.emittedInvoices.number, inv.number)
        )
      );

    if (existing) {
      skippedDuplicates++;
      continue;
    }

    // Găsire sau inserare client în nomenclatorul de clienți
    let clientId: number | undefined;
    if (inv.clientCUI || inv.clientName || inv.clientCode) {
      const [existingClient] = await db
        .select({ id: schema.clients.id, sagaCode: schema.clients.sagaCode })
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.tenantId, tenantId),
            inv.clientCUI
              ? eq(schema.clients.cui, inv.clientCUI)
              : inv.clientCode
                ? eq(schema.clients.sagaCode, inv.clientCode)
                : eq(schema.clients.name, inv.clientName)
          )
        );

      if (existingClient) {
        clientId = existingClient.id;
        if (!existingClient.sagaCode && inv.clientCode) {
          await db
            .update(schema.clients)
            .set({ sagaCode: inv.clientCode })
            .where(eq(schema.clients.id, existingClient.id));
        }
      } else {
        const [insertedClient] = await db.insert(schema.clients).values({
          tenantId,
          name: inv.clientName,
          cui: inv.clientCUI || null,
          sagaCode: inv.clientCode || null,
          regCom: inv.clientRegCom || null,
          address: inv.clientAddress || null,
          city: inv.clientCity || null,
          country: (inv.clientCountry || "UE").slice(0, 2).toUpperCase(),
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
      clientCode: inv.clientCode || null,
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
      status: inv.status || "sent",
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

  const messageParts: string[] = [];
  if (imported > 0) {
    messageParts.push(`${imported} ${imported === 1 ? "factură externă importată" : "facturi externe importate"}`);
  } else {
    messageParts.push("Nu au fost găsite facturi externe noi");
  }
  if (skippedRo > 0) {
    messageParts.push(`${skippedRo} ${skippedRo === 1 ? "factură din România omisă" : "facturi din România omise"} automat (se preiau prin SPV)`);
  }
  if (skippedDuplicates > 0) {
    messageParts.push(`${skippedDuplicates} duplicate omise`);
  }

  return {
    imported,
    skipped: skippedDuplicates + skippedRo,
    skippedDuplicates,
    skippedRo,
    total: invoices.length,
    createdIds,
    message: messageParts.join(", ") + ".",
  };
}
