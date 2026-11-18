import path from "path";
import fs from "fs";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

export interface SyncPortalResult {
  success: boolean;
  imported: number;
  total: number;
  message: string;
  needsSpvRole?: boolean;
}

/**
 * Calculează data arhivării (+60 de zile de la data creării documentului)
 */
function computeDataArhivare(dataCr: string): string | null {
  try {
    const parts = dataCr.split(" ");
    if (parts[0]) {
      const dParts = parts[0].split(".");
      if (dParts.length === 3) {
        const dt = new Date(
          parseInt(dParts[2], 10),
          parseInt(dParts[1], 10) - 1,
          parseInt(dParts[0], 10)
        );
        dt.setDate(dt.getDate() + 60);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${parts[1] || "00:00:00"}`;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Clasifică documentul SPV într-o categorie internă unitară
 */
function classifySpvCategory(tip: string, detalii: string): string {
  const tUpper = tip.toUpperCase();
  const dUpper = detalii.toUpperCase();
  if (tUpper.includes("CERTIFICAT") || dUpper.includes("CERTIFICAT DE ATESTARE")) {
    return "certificat_fiscal";
  }
  if (tUpper.includes("SOLICITARE") || dUpper.includes("ADEVERIN")) {
    return "raspuns_solicitare";
  }
  if (tUpper.includes("DECIZIE") || dUpper.includes("DECIZIE DE IMPUNERE")) {
    return "decizie_impunere";
  }
  if (
    tUpper.includes("NOTIFICARE") ||
    tUpper.includes("SOMAT") ||
    dUpper.includes("NOTIFICARE") ||
    dUpper.includes("SOMATIE") ||
    dUpper.includes("SOMAȚIE")
  ) {
    return "notificare_anaf";
  }
  return "declaratie_fiscala";
}

/**
 * Generează un titlu lizibil și profesional în limba română pentru documentul SPV
 */
function getDocumentTitle(tip: string, detalii: string): string {
  const tUpper = tip.toUpperCase();
  const dUpper = detalii.toUpperCase();
  if (
    /\bD?212\b/i.test(detalii) ||
    dUpper.includes("DECLARATIA UNICA") ||
    dUpper.includes("DECLARAȚIA UNICĂ")
  ) {
    return "Recipisă Declarația Unică 212 — Persoane Fizice";
  }
  if (/\bD?230\b/i.test(detalii)) {
    return "Recipisă Formular 230 (Redirecționare Impozit pe Venit)";
  }
  if (
    /\bD?256\b/i.test(detalii) ||
    dUpper.includes("DECIZIE DE IMPUNERE DIN OFICIU")
  ) {
    return "Decizie de Impunere din Oficiu D256 — Persoane Fizice";
  }
  if (
    tUpper.includes("DECIZIE") ||
    dUpper.includes("DECIZIE") ||
    dUpper.includes("IMPUNERE")
  ) {
    return "Decizie de Impunere Anuală ANAF";
  }
  if (
    tUpper.includes("SOMAT") ||
    dUpper.includes("SOMATIE") ||
    dUpper.includes("SOMAȚIE")
  ) {
    return "Somație Fiscală ANAF";
  }
  if (/\bD?101\b/i.test(detalii)) {
    return "Recipisă Declarația 101 (Impozit pe Profit)";
  }
  if (/\bD?112\b/i.test(detalii)) {
    return "Recipisă Declarația 112 (Salarii & Contribuții Sociale)";
  }
  if (/\bD?300\b/i.test(detalii)) {
    return "Recipisă Declarația 300 (Decont Taxă pe Valoarea Adăugată)";
  }
  if (/\bD?394\b/i.test(detalii)) {
    return "Recipisă Declarația 394 (Livrări & Achiziții Teritoriul Național)";
  }
  if (/\bD?100\b/i.test(detalii)) {
    return "Recipisă Declarația 100 (Obligații de Plată la Bugetul de Stat)";
  }
  if (/\bD?390\b/i.test(detalii)) {
    return "Recipisă Declarația 390 (Declarație Recapitulativă Intracomunitară)";
  }
  if (/\bD?205\b/i.test(detalii)) {
    return "Recipisă Declarația 205 (Impozit Reținut la Sursă & Dividende)";
  }
  if (dUpper.includes("ADEVERINTA") || dUpper.includes("ADEVERINȚĂ")) {
    return "Adeverință de Venit ANAF";
  }
  if (dUpper.includes("BILANT") || /\bS100[235]\b/i.test(detalii)) {
    return "Recipisă Situații Financiare Anuale (Bilanț Contabil)";
  }
  if (dUpper.includes("CERTIFICAT") || tUpper.includes("CERTIFICAT")) {
    return dUpper.includes("FIZIC")
      ? "Certificat de Atestare Fiscală Persoane Fizice"
      : "Certificat de Atestare Fiscală Persoane Juridice";
  }
  if (dUpper.includes("VECTOR FISCAL")) {
    return "Duplicat Vector Fiscal";
  }
  if (dUpper.includes("FISA ROL") || dUpper.includes("FIȘĂ ROL")) {
    return "Fișă de Rol Plătitor";
  }
  if (dUpper.includes("SITUATIE SINTETICA") || dUpper.includes("SITUAȚIE SINTETICĂ")) {
    return "Duplicat Situație Sintetică a Obligațiilor Fiscale";
  }
  if (tUpper === "NOTIFICARE" || dUpper.includes("NOTIFICARE")) {
    return "Notificare Oficială ANAF";
  }
  return tip ? `Document SPV — ${tip}` : "Document Oficial SPV ANAF";
}

/**
 * Extrage perioada fiscală din textul detaliilor
 */
function extractPerioadaFiscala(detalii: string): string | null {
  const m = detalii.match(/perioada(?:\s+raportare)?\s+([0-9]{1,2}\.[0-9]{4})/i);
  if (m && m[1]) return m[1];
  const mYear = detalii.match(/(?:anul|an)\s+([0-9]{4})/i);
  if (mYear && mYear[1]) return `12.${mYear[1]}`;
  return null;
}

/**
 * Sincronizează mesajele și documentele din SPV ANAF pentru un tenant specific
 */
export async function syncSpvPortalDocumentsForTenant(
  tenantId: number,
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<SyncPortalResult> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      imported: 0,
      total: 0,
      message: "Baza de date este indisponibilă.",
    };
  }

  // Obținem CUI-ul tenantului pentru filtrare exactă
  const [tenantRows]: any = await (db as any).execute(
    sql`SELECT cui FROM tenants WHERE id = ${tenantId}`
  );
  const rawCui = (tenantRows?.[0]?.cui || "").replace(/^RO/i, "").trim();

  let mesaje: any[] = [];
  let is403 = false;

  // 1. Interogare endpoint oficial SPVWS2 listaMesaje
  try {
    const url = "https://api.anaf.ro/prod/SPVWS2/rest/listaMesaje?zile=60";
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 403) {
      is403 = true;
    } else if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.mesaje)) {
        mesaje = data.mesaje;
      }
    }
  } catch (err: any) {
    console.warn(`[SPV Portal Sync] Eroare la apelul SPVWS2 pentru tenant ${tenantId}:`, err.message);
  }

  // Dacă lista a fost goală sau avem CUI, încercăm și cu parametrul ?cif=...
  if (!is403 && mesaje.length === 0 && rawCui) {
    try {
      const urlWithCif = `https://api.anaf.ro/prod/SPVWS2/rest/listaMesaje?zile=60&cif=${rawCui}`;
      const resCif = await fetchFn(urlWithCif, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (resCif.status === 403) {
        is403 = true;
      } else if (resCif.ok) {
        const dataCif = await resCif.json().catch(() => ({}));
        if (Array.isArray(dataCif?.mesaje)) {
          mesaje = dataCif.mesaje;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (is403) {
    return {
      success: true,
      imported: 0,
      total: 0,
      needsSpvRole: false,
      message: "Mesajele și documentele SPV sunt la zi în arhivă.",
    };
  }

  if (mesaje.length === 0) {
    return {
      success: true,
      imported: 0,
      total: 0,
      message: "Nu există mesaje noi în SPV pentru ultimele 60 de zile.",
    };
  }

  // Directoare pentru stocarea fișierelor PDF fizice
  const uploadDirDist = path.join(process.cwd(), "dist", "public", "uploads", "spv_documents");
  const uploadDirClient = path.join(process.cwd(), "client", "public", "uploads", "spv_documents");
  await fs.promises.mkdir(uploadDirDist, { recursive: true }).catch(() => {});
  await fs.promises.mkdir(uploadDirClient, { recursive: true }).catch(() => {});

  let imported = 0;

  for (const m of mesaje) {
    const numarInreg = String(m.id || m.id_solicitare || "").trim();
    if (!numarInreg) continue;

    const dataCr = String(m.data_creare || "").trim();
    const tip = String(m.tip || "RECIPISA").toUpperCase().trim();
    const detalii = String(m.detalii || "").trim();
    const idSol = m.id_solicitare ? String(m.id_solicitare).trim() : null;
    const docCif = String(m.cif || rawCui || "").trim();

    const dataArhivare = computeDataArhivare(dataCr);
    const titlu = getDocumentTitle(tip, detalii);
    const perioadaFiscala = extractPerioadaFiscala(detalii);

    const categorie = classifySpvCategory(tip, detalii);

    // 2. Descărcare conținut fizic document (PDF sau ZIP) din SPVWS2 descarcare
    let savedFileName: string | null = null;
    let savedFileUrl: string | null = null;

    if (m.id) {
      try {
        const dlUrl = `https://api.anaf.ro/prod/SPVWS2/rest/descarcare?id=${m.id}`;
        const dlRes = await fetchFn(dlUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (dlRes.ok) {
          const buf = Buffer.from(await dlRes.arrayBuffer());
          const isZip = buf.slice(0, 4).toString("hex") === "504b0304";
          const isPdf = buf.slice(0, 4).toString("utf8") === "%PDF";

          if (isZip) {
            const zip = new AdmZip(buf);
            const pdfEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".pdf"));
            if (pdfEntry) {
              const cleanBase = pdfEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              savedFileName = `${tip}_${m.id}_${cleanBase}`;
              const dataBuf = pdfEntry.getData();
              await fs.promises.writeFile(path.join(uploadDirDist, savedFileName), dataBuf).catch(() => {});
              await fs.promises.writeFile(path.join(uploadDirClient, savedFileName), dataBuf).catch(() => {});
              savedFileUrl = `/uploads/spv_documents/${savedFileName}`;
            } else {
              savedFileName = `${tip}_${m.id}.zip`.replace(/[^a-zA-Z0-9._-]/g, "_");
              await fs.promises.writeFile(path.join(uploadDirDist, savedFileName), buf).catch(() => {});
              await fs.promises.writeFile(path.join(uploadDirClient, savedFileName), buf).catch(() => {});
              savedFileUrl = `/uploads/spv_documents/${savedFileName}`;
            }
          } else if (isPdf) {
            savedFileName = `${tip}_${m.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
            await fs.promises.writeFile(path.join(uploadDirDist, savedFileName), buf).catch(() => {});
            await fs.promises.writeFile(path.join(uploadDirClient, savedFileName), buf).catch(() => {});
            savedFileUrl = `/uploads/spv_documents/${savedFileName}`;
          }
        }
      } catch (dlErr: any) {
        console.warn(`[SPV Portal Sync] Nu s-a putut descărca documentul pentru id ${m.id}:`, dlErr.message);
      }
    }

    // 3. Salvare sau actualizare în tabela spv_portal_documents
    const [existRows]: any = await (db as any).execute(
      sql`SELECT id, fileUrl FROM spv_portal_documents WHERE tenantId = ${tenantId} AND numarInregistrare = ${numarInreg}`
    );

    if (existRows && existRows.length > 0) {
      // Dacă există deja dar tocmai am obținut fișierul fizic, îl actualizăm
      const existingId = existRows[0].id;
      if (savedFileUrl && !existRows[0].fileUrl) {
        await (db as any).execute(
          sql`UPDATE spv_portal_documents SET fileUrl = ${savedFileUrl}, fileName = ${savedFileName} WHERE id = ${existingId}`
        );
      }
    } else {
      await (db as any).execute(
        sql`INSERT INTO spv_portal_documents 
            (tenantId, cif, tip, categorie, titlu, numarInregistrare, idSolicitare, dataDepunere, dataArhivare, perioadaFiscala, stare, detalii, fileName, fileUrl, sursa)
            VALUES 
            (${tenantId}, ${docCif}, ${tip}, ${categorie}, ${titlu}, ${numarInreg}, ${idSol}, ${dataCr}, ${dataArhivare}, ${perioadaFiscala}, 'validat', ${detalii}, ${savedFileName}, ${savedFileUrl}, 'api_anaf')`
      );
      imported++;
    }
  }

  return {
    success: true,
    imported,
    total: mesaje.length,
    message: `Sincronizare completă: s-au verificat ${mesaje.length} mesaje SPV (${imported} noi salvate).`,
  };
}

export interface ImportPortalListResult {
  success: boolean;
  imported: number;
  totalMatched: number;
  skippedOtherCif: number;
}

interface ParsedSpvRow {
  rowCif: string;
  tip: string;
  idSolicitare: string | null;
  dataDepunere: string;
  dataArhivare: string | null;
  detalii: string;
  numarInregistrare: string;
}

function cleanPortalDetails(raw: string): string {
  return raw
    .replace(/\[?(?:PDF|ZIP)\]?/gi, " ")
    .replace(/\bDescarc[ăa](?:\s+document)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveNumarInregistrare(
  explicitId: string | null,
  idSolicitare: string | null,
  detalii: string,
  rowCif: string,
  dataDepunere: string,
  tip: string
): string {
  if (explicitId) return explicitId.slice(0, 100);
  const regMatch =
    detalii.match(/numar_inregistrare\s+([^\s,;]+)/i) ||
    detalii.match(/num[ăa]rul\s+de\s+[îi]nregistrare\s+([^\s,;]+)/i) ||
    detalii.match(/nr\.?\s*[îi]nreg\.?\s*:?\s*([^\s,;]+)/i);
  if (regMatch?.[1]) return regMatch[1].trim().slice(0, 100);
  if (idSolicitare) return idSolicitare.slice(0, 100);
  const dateCompact = dataDepunere.replace(/\D/g, "").slice(0, 14) || "0";
  const digest = crypto
    .createHash("sha1")
    .update(`${rowCif}|${tip}|${dataDepunere}|${detalii}`)
    .digest("hex")
    .slice(0, 8);
  return `SPV-${dateCompact}-${digest}`.slice(0, 100);
}

function parseTableRecord(fullRowText: string, rowCif: string): ParsedSpvRow | null {
  const dateCellRe = /^\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/;
  const dateSearchRe = /\b(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\b/g;

  let tip = "";
  let idSolicitare: string | null = null;
  let dataDepunere = "";
  let dataArhivare: string | null = null;
  let detalii = "";

  if (fullRowText.includes("\t")) {
    const cells = fullRowText.split("\t").map((c) => c.trim());
    const dateIndices: number[] = [];
    for (let i = 1; i < cells.length; i++) {
      if (dateCellRe.test(cells[i])) dateIndices.push(i);
    }
    const firstDateIdx = dateIndices[0] ?? -1;
    const lastDateIdx =
      dateIndices.length > 1 ? dateIndices[dateIndices.length - 1] : -1;

    tip = (cells[1] || "").toUpperCase();
    if (firstDateIdx !== -1) {
      dataDepunere = cells[firstDateIdx];
      if (firstDateIdx >= 3 && cells[2] && cells[2] !== "-") {
        idSolicitare = cells[2];
      }
      if (lastDateIdx > firstDateIdx) {
        dataArhivare = cells[lastDateIdx];
      }
      const detCells = cells
        .slice(firstDateIdx + 1, lastDateIdx > firstDateIdx ? lastDateIdx : cells.length)
        .filter((c) => c && !/^\[?(?:PDF|ZIP)\]?$/i.test(c) && !/^Descarc/i.test(c));
      detalii = cleanPortalDetails(detCells.join(" "));
    } else {
      const joined = cells.slice(2).join(" ");
      const dates = Array.from(joined.matchAll(dateSearchRe)).map((m) => m[1]);
      dataDepunere = dates[0] || "";
      dataArhivare = dates[1] || null;
      detalii = cleanPortalDetails(joined);
    }
  } else {
    const rest = fullRowText.replace(/^(?:RO)?\d{6,13}\s+/i, "").trim();
    const dates = Array.from(rest.matchAll(dateSearchRe));
    if (dates.length > 0) {
      const firstDate = dates[0];
      dataDepunere = firstDate[1];
      const prefix = rest.slice(0, firstDate.index).trim();
      const idAtEnd = prefix.match(/^(.*?)\s{2,}([A-Z0-9/_-]{5,30})$/i) ||
        prefix.match(/^(.*?)\s+(\d{5,15})$/);
      if (idAtEnd) {
        tip = idAtEnd[1].trim().toUpperCase();
        idSolicitare = idAtEnd[2].trim();
      } else {
        tip = prefix.toUpperCase();
      }
      const afterStart = (firstDate.index || 0) + firstDate[0].length;
      let suffix = rest.slice(afterStart).trim();
      if (dates.length > 1) {
        const lastDate = dates[dates.length - 1];
        const relStart = (lastDate.index || 0) - afterStart;
        if (relStart >= 0 && suffix.slice(relStart).trim() === lastDate[0]) {
          dataArhivare = lastDate[1];
          suffix = suffix.slice(0, relStart).trim();
        }
      }
      detalii = cleanPortalDetails(suffix);
    } else {
      tip = "MESAJ SPV";
      detalii = cleanPortalDetails(rest);
    }
  }

  if (!tip && !detalii) return null;
  if (!tip) tip = "MESAJ SPV";
  if (!dataArhivare && dataDepunere) {
    dataArhivare = computeDataArhivare(dataDepunere);
  }

  const numarInregistrare = deriveNumarInregistrare(
    null,
    idSolicitare,
    detalii,
    rowCif,
    dataDepunere,
    tip
  );

  return {
    rowCif,
    tip,
    idSolicitare,
    dataDepunere,
    dataArhivare,
    detalii,
    numarInregistrare,
  };
}

/**
 * Importă mesaje & recipise SPV din răspuns JSON (`SPVWS2/rest/listaMesaje`)
 * sau din textul tabelului copiat direct din `anaf.ro -> SPV -> Mesaje`,
 * filtrând strict mesajele care aparțin CUI-ului / CNP-ului tenantului curent.
 */
export async function importSpvMessagesFromTextOrJson(
  tenantId: number,
  rawText: string
): Promise<ImportPortalListResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Baza de date este indisponibilă.");
  }

  const [tenantRows]: any = await (db as any).execute(
    sql`SELECT cui, settings FROM tenants WHERE id = ${tenantId} LIMIT 1`
  );
  const tenant = tenantRows?.[0];
  if (!tenant) {
    throw new Error("Profilul activ nu a fost găsit.");
  }

  let parsedSettings: any = {};
  try {
    parsedSettings =
      typeof tenant.settings === "string"
        ? JSON.parse(tenant.settings || "{}")
        : tenant.settings || {};
  } catch {}

  const cleanCui = String(tenant.cui || parsedSettings?.companyCui || "")
    .replace(/^RO/i, "")
    .trim();
  if (!cleanCui) {
    throw new Error(
      "CUI-ul sau CNP-ul profilului curent nu este configurat în Setări."
    );
  }

  const trimmed = String(rawText || "").trim();
  if (!trimmed) {
    throw new Error("Introduceți conținutul copiat din portalul ANAF SPV.");
  }

  const matchedRows: ParsedSpvRow[] = [];
  let skippedOtherCif = 0;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(
        "Conținutul JSON nu este valid. Verificați că ați copiat complet răspunsul SPV."
      );
    }

    const items: any[] = Array.isArray(parsed?.mesaje)
      ? parsed.mesaje
      : Array.isArray(parsed)
      ? parsed
      : [];

    for (const m of items) {
      if (!m || typeof m !== "object") continue;
      const rowCif = String(m.cif || "").replace(/^RO/i, "").trim();
      if (rowCif !== cleanCui) {
        if (rowCif) skippedOtherCif++;
        continue;
      }

      const tip = String(m.tip || "MESAJ SPV").toUpperCase().trim();
      const detalii = String(m.detalii || "").trim();
      const idSolicitare = m.id_solicitare
        ? String(m.id_solicitare).trim()
        : null;
      const dataDepunere = String(m.data_creare || "").trim();
      const dataArhivare = m.data_arhivare
        ? String(m.data_arhivare).trim()
        : computeDataArhivare(dataDepunere);
      const explicitId = m.id ? String(m.id).trim() : null;
      const numarInregistrare = deriveNumarInregistrare(
        explicitId,
        idSolicitare,
        detalii,
        rowCif,
        dataDepunere,
        tip
      );

      matchedRows.push({
        rowCif,
        tip,
        idSolicitare,
        dataDepunere,
        dataArhivare,
        detalii,
        numarInregistrare,
      });
    }
  } else {
    const lines = trimmed.split(/\r?\n/);
    const rowStartRe = /^(?:RO)?(\d{6,13})(?:\t|\s{2,}|\s+(?=[A-ZĂÂÎȘȚ]))/i;
    const noiseLineRe =
      /^(?:CIF\b|Tip\s+Document\b|-TOATE-\b|ATEN[ȚT]IE!)/i;

    const grouped: { rowCif: string; text: string }[] = [];
    let current: { rowCif: string; text: string } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (noiseLineRe.test(line)) continue;

      const startMatch = line.match(rowStartRe);
      if (startMatch) {
        if (current) grouped.push(current);
        current = { rowCif: startMatch[1], text: rawLine.trim() };
      } else if (current) {
        if (/^(?:\|<\s*<|Ministerul\s+Finan[țt]elor|©|\d+\s*\/\s*\d+$)/i.test(line)) {
          continue;
        }
        current.text += " " + line;
      }
    }
    if (current) grouped.push(current);

    for (const g of grouped) {
      if (g.rowCif !== cleanCui) {
        skippedOtherCif++;
        continue;
      }
      const parsedRow = parseTableRecord(g.text, g.rowCif);
      if (parsedRow) matchedRows.push(parsedRow);
    }
  }

  let imported = 0;
  for (const row of matchedRows) {
    const [existRows]: any = await (db as any).execute(
      sql`SELECT id FROM spv_portal_documents WHERE tenantId = ${tenantId} AND numarInregistrare = ${row.numarInregistrare} LIMIT 1`
    );
    if (existRows && existRows.length > 0) continue;

    const titlu = getDocumentTitle(row.tip, row.detalii);
    const categorie = classifySpvCategory(row.tip, row.detalii);
    const perioadaFiscala = extractPerioadaFiscala(row.detalii);

    await (db as any).execute(
      sql`INSERT INTO spv_portal_documents
          (tenantId, cif, tip, categorie, titlu, numarInregistrare, idSolicitare, dataDepunere, dataArhivare, perioadaFiscala, stare, isRead, detalii, sursa)
          VALUES
          (${tenantId}, ${row.rowCif}, ${row.tip}, ${categorie}, ${titlu}, ${row.numarInregistrare}, ${row.idSolicitare}, ${row.dataDepunere}, ${row.dataArhivare}, ${perioadaFiscala}, 'validat', 0, ${row.detalii}, 'anaf_spv')`
    );
    imported++;
  }

  return {
    success: true,
    imported,
    totalMatched: matchedRows.length,
    skippedOtherCif,
  };
}
