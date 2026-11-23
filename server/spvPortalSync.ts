import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { sql } from "drizzle-orm";

export interface SyncPortalResult {
  success: boolean;
  imported: number;
  total: number;
  message: string;
  needsSpvRole?: boolean;
}

export interface SaveRealSpvDocInput {
  anafId?: unknown;
  cif?: unknown;
  tip?: unknown;
  idSolicitare?: unknown;
  dataCreare?: unknown;
  detalii?: unknown;
  fileBase64?: unknown;
  originalFileName?: unknown;
}

export type SaveRealSpvDocResult =
  | {
      ok: true;
      skippedDuplicate: boolean;
      id: number | null;
      fileUrl?: string;
      fileName?: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

export async function getTenantCleanCui(
  db: any,
  tenantId: number
): Promise<string> {
  const [tenantRows]: any = await db.execute(
    sql`SELECT cui, settings FROM tenants WHERE id = ${tenantId} LIMIT 1`
  );
  const tenantRow = tenantRows?.[0];
  let parsedSettings: any = {};
  try {
    parsedSettings =
      typeof tenantRow?.settings === "string"
        ? JSON.parse(tenantRow.settings || "{}")
        : tenantRow?.settings || {};
  } catch {}
  return String(tenantRow?.cui || parsedSettings?.companyCui || "")
    .replace(/^RO/i, "")
    .trim();
}

export async function saveRealSpvDocument(
  db: any,
  tenantId: number,
  cleanCui: string,
  item: SaveRealSpvDocInput
): Promise<SaveRealSpvDocResult> {
  const normAnafId = String(item?.anafId || "").trim();
  const normReqCif = String(item?.cif || "").replace(/^RO/i, "").trim();
  if (!normAnafId) {
    return { ok: false, statusCode: 400, error: "Lipsește ID-ul documentului ANAF." };
  }
  if (!normReqCif || normReqCif !== cleanCui) {
    return {
      ok: false,
      statusCode: 400,
      error: `Documentul aparține CIF/CNP ${normReqCif || "-"}, nu profilului activ (${cleanCui}).`,
    };
  }
  if (!item?.fileBase64 || typeof item.fileBase64 !== "string") {
    return {
      ok: false,
      statusCode: 400,
      error: "Lipsește conținutul binar al documentului ANAF.",
    };
  }

  const rawBuf = Buffer.from(item.fileBase64, "base64");
  if (rawBuf.length < 100) {
    return {
      ok: false,
      statusCode: 400,
      error: "Fișierul primit din ANAF este gol sau incomplet.",
    };
  }

  const isPdf = rawBuf.slice(0, 5).toString("utf8") === "%PDF-";
  const isZip = rawBuf.slice(0, 4).toString("hex") === "504b0304";
  if (!isPdf && !isZip) {
    return {
      ok: false,
      statusCode: 400,
      error: "Fișierul descărcat nu este un PDF sau ZIP valid semnat de ANAF.",
    };
  }

  const [existRows]: any = await db.execute(
    sql`SELECT id, fileUrl FROM spv_portal_documents WHERE tenantId = ${tenantId} AND numarInregistrare = ${normAnafId} LIMIT 1`
  );
  if (existRows?.[0]?.fileUrl) {
    return {
      ok: true,
      skippedDuplicate: true,
      id: existRows[0].id,
    };
  }

  const normTip = String(item?.tip || "DOCUMENT").toUpperCase().trim();
  const normDetalii = String(item?.detalii || "").trim();
  const safeTip = normTip.replace(/[^a-zA-Z0-9_-]/g, "_");

  let finalBuf: Buffer = rawBuf;
  let finalFileName = "";
  if (isPdf) {
    const requestedBase = item?.originalFileName
      ? path.basename(String(item.originalFileName)).replace(/[^a-zA-Z0-9._-]/g, "_")
      : "";
    finalFileName =
      requestedBase && requestedBase.toLowerCase().endsWith(".pdf")
        ? requestedBase
        : `${safeTip}_${normAnafId}.pdf`;
  } else {
    const zip = new AdmZip(rawBuf);
    const pdfEntry = zip
      .getEntries()
      .find((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".pdf"));
    if (pdfEntry) {
      const entryBuf = pdfEntry.getData();
      if (entryBuf.slice(0, 5).toString("utf8") === "%PDF-") {
        finalBuf = entryBuf;
        const entryBase = path.basename(pdfEntry.entryName).replace(/[^a-zA-Z0-9._-]/g, "_");
        finalFileName = `${safeTip}_${normAnafId}_${entryBase}`;
      } else {
        finalFileName = `${safeTip}_${normAnafId}.zip`;
      }
    } else {
      finalFileName = `${safeTip}_${normAnafId}.zip`;
    }
  }

  const uploadDirDist = path.join(process.cwd(), "dist", "public", "uploads", "spv_documents");
  const uploadDirClient = path.join(process.cwd(), "client", "public", "uploads", "spv_documents");
  await fs.promises.mkdir(uploadDirDist, { recursive: true }).catch(() => {});
  await fs.promises.mkdir(uploadDirClient, { recursive: true }).catch(() => {});

  const diskKey = `${tenantId}_${normAnafId}_${finalFileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  await fs.promises.writeFile(path.join(uploadDirDist, diskKey), finalBuf);
  await fs.promises.writeFile(path.join(uploadDirClient, diskKey), finalBuf).catch(() => {});
  const fileUrl = `/uploads/spv_documents/${diskKey}`;

  const rawDepunere = String(item?.dataCreare || "").trim();
  const [sameDayRows]: any = await db.execute(
    sql`SELECT numarInregistrare, dataDepunere FROM spv_portal_documents WHERE tenantId = ${tenantId}`
  );
  const dataDepunere = resolveAnaf24hTimestamp(
    rawDepunere,
    finalBuf,
    normAnafId,
    Array.isArray(sameDayRows) ? sameDayRows : []
  );
  const dataArhivare = computeDataArhivare(dataDepunere);
  const titlu = getDocumentTitle(normTip, normDetalii);
  const categorie = classifySpvCategory(normTip, normDetalii);
  const perioadaFiscala = extractPerioadaFiscala(normDetalii);
  const normSolicitare = item?.idSolicitare ? String(item.idSolicitare).trim() : null;

  if (existRows?.[0]?.id) {
    await db.execute(
      sql`UPDATE spv_portal_documents SET fileUrl = ${fileUrl}, fileName = ${finalFileName}, dataDepunere = ${dataDepunere}, dataArhivare = ${dataArhivare}, titlu = ${titlu}, sursa = 'webserviced_anaf' WHERE id = ${existRows[0].id}`
    );
    return {
      ok: true,
      skippedDuplicate: false,
      id: existRows[0].id,
      fileUrl,
      fileName: finalFileName,
    };
  }

  const [insRes]: any = await db.execute(
    sql`INSERT INTO spv_portal_documents
        (tenantId, cif, tip, categorie, titlu, numarInregistrare, idSolicitare, dataDepunere, dataArhivare, perioadaFiscala, stare, isRead, detalii, fileName, fileUrl, sursa)
        VALUES
        (${tenantId}, ${cleanCui}, ${normTip}, ${categorie}, ${titlu}, ${normAnafId}, ${normSolicitare}, ${dataDepunere}, ${dataArhivare}, ${perioadaFiscala}, 'validat', 0, ${normDetalii}, ${finalFileName}, ${fileUrl}, 'webserviced_anaf')`
  );

  return {
    ok: true,
    skippedDuplicate: false,
    id: insRes?.insertId || null,
    fileUrl,
    fileName: finalFileName,
  };
}

/**
 * ANAF SPVWS2/rest/listaMesaje formatează data_creare cu Java "dd.MM.yyyy hh:mm:ss" (12h fără AM/PM),
 * transformând orele de după-amiază (ex: 16:25:09 -> 04:25:09, 13:20:18 -> 01:20:18).
 * Reconstituim ora exactă 24h din metadatele D:YYYYMMDDHHmmss ale PDF-ului original semnat de ANAF
 * și/sau din ordinea strict monotonă a ID-urilor ANAF din aceeași zi.
 */
export function resolveAnaf24hTimestamp(
  rawDateStr: string,
  pdfBuf?: Buffer | null,
  anafId?: string | null,
  siblingRows?: Array<{ numarInregistrare?: string | null; dataDepunere?: string | null }>
): string {
  const trimmed = String(rawDateStr || "").trim();
  const m = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return trimmed;

  const [, dd, mm, yyyy, hhStr, minStr, secStr = "00"] = m;
  const rawHour = parseInt(hhStr, 10);
  if (isNaN(rawHour) || rawHour < 1 || rawHour > 11) {
    return `${dd}.${mm}.${yyyy} ${hhStr}:${minStr}:${secStr}`;
  }

  let shouldAdd12 = false;
  const targetYmd = `${yyyy}${mm}${dd}`;

  // 1. Verificare metadate interne D:YYYYMMDDHHmmss din PDF-ul original semnat de ANAF
  if (pdfBuf && pdfBuf.length > 0) {
    try {
      const latin = pdfBuf.toString("latin1");
      const dateMatches = latin.match(/D:(\d{8})(\d{2})(\d{2})(\d{2})/g) || [];
      const sameDayPdfHours: number[] = [];
      for (const dm of dateMatches) {
        const ymd = dm.slice(2, 10);
        const pHour = parseInt(dm.slice(10, 12), 10);
        if (ymd === targetYmd && !isNaN(pHour)) {
          sameDayPdfHours.push(pHour);
        }
      }
      if (sameDayPdfHours.length > 0) {
        const maxPdfHour = Math.max(...sameDayPdfHours);
        if (maxPdfHour >= 12) {
          shouldAdd12 = true;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Verificare secvență monotonă ANAF ID în aceeași zi (dacă un ID mai mic din aceeași zi are ora > rawHour)
  const numericId = anafId && /^\d+$/.test(String(anafId)) ? Number(anafId) : null;
  if (!shouldAdd12 && numericId && Array.isArray(siblingRows)) {
    const datePrefix = `${dd}.${mm}.${yyyy} `;
    for (const sib of siblingRows) {
      const sibIdStr = String(sib?.numarInregistrare || "");
      const sibDep = String(sib?.dataDepunere || "");
      if (!/^\d+$/.test(sibIdStr) || !sibDep.startsWith(datePrefix)) continue;
      const sibId = Number(sibIdStr);
      const sibHour = parseInt(sibDep.slice(datePrefix.length, datePrefix.length + 2), 10);
      if (sibId < numericId && !isNaN(sibHour) && sibHour > rawHour) {
        shouldAdd12 = true;
        break;
      }
    }
  }

  const finalHour = shouldAdd12 ? rawHour + 12 : rawHour;
  return `${dd}.${mm}.${yyyy} ${String(finalHour).padStart(2, "0")}:${minStr}:${secStr}`;
}

const repairedPortalTenants = new Set<number>();

/**
 * Repară idempotent orele 12h (hh:mm:ss) și dataArhivare (+62 zile conform portalului ANAF)
 * pentru documentele reale deja descărcate pe disc.
 */
export async function ensureTenantSpvPortalTimestampsNormalized(
  db: any,
  tenantId: number
): Promise<void> {
  if (repairedPortalTenants.has(tenantId)) return;
  try {
    const [rows]: any = await db.execute(
      sql`SELECT id, tip, detalii, numarInregistrare, dataDepunere, dataArhivare, fileUrl, titlu FROM spv_portal_documents WHERE tenantId = ${tenantId}`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      repairedPortalTenants.add(tenantId);
      return;
    }

    // Sortăm crescător după ID-ul ANAF ca secvența monotonă din aceeași zi să se propage corect
    const sortedAsc = [...rows].sort((a, b) => {
      const na = /^\d+$/.test(String(a.numarInregistrare || "")) ? Number(a.numarInregistrare) : 0;
      const nb = /^\d+$/.test(String(b.numarInregistrare || "")) ? Number(b.numarInregistrare) : 0;
      return na - nb;
    });

    for (const r of sortedAsc) {
      if (!r.dataDepunere) continue;
      let pdfBuf: Buffer | null = null;
      if (r.fileUrl && typeof r.fileUrl === "string") {
        const rel = r.fileUrl.replace(/^\/+/, "");
        const pDist = path.join(process.cwd(), "dist", "public", rel);
        const pClient = path.join(process.cwd(), "client", "public", rel);
        if (fs.existsSync(pDist)) {
          pdfBuf = await fs.promises.readFile(pDist).catch(() => null);
        } else if (fs.existsSync(pClient)) {
          pdfBuf = await fs.promises.readFile(pClient).catch(() => null);
        }
      }

      const normDep = resolveAnaf24hTimestamp(
        String(r.dataDepunere),
        pdfBuf,
        String(r.numarInregistrare || ""),
        sortedAsc
      );
      const normArh = computeDataArhivare(normDep) || r.dataArhivare;
      const normTitle = getDocumentTitle(String(r.tip || ""), String(r.detalii || ""));

      if (normDep !== r.dataDepunere || normArh !== r.dataArhivare || normTitle !== r.titlu) {
        r.dataDepunere = normDep;
        r.dataArhivare = normArh;
        await db.execute(
          sql`UPDATE spv_portal_documents SET dataDepunere = ${normDep}, dataArhivare = ${normArh}, titlu = ${normTitle} WHERE id = ${r.id}`
        );
      }
    }
    repairedPortalTenants.add(tenantId);
  } catch (err: any) {
    console.warn("[SPV Timestamp Normalize] Warning:", err?.message);
  }
}

/**
 * Calculează data arhivării (+62 de zile de la data afișării în SPV, identic cu portalul ANAF)
 */
export function computeDataArhivare(dataCr: string): string | null {
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
        dt.setDate(dt.getDate() + 62);
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
export function classifySpvCategory(tip: string, detalii: string): string {
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
    tUpper === "ADRESE" ||
    dUpper.includes("NOTIFICARE") ||
    dUpper.includes("SOMATIE") ||
    dUpper.includes("SOMAȚIE") ||
    dUpper.includes("POPRIR")
  ) {
    return "notificare_anaf";
  }
  return "declaratie_fiscala";
}

/**
 * Generează un titlu lizibil în limba română pentru documentul SPV real descărcat sau încărcat
 */
export function getDocumentTitle(tip: string, detalii: string): string {
  const tUpper = tip.toUpperCase();
  const dUpper = detalii.toUpperCase();
  if (
    /\bD?212\b/i.test(detalii) ||
    dUpper.includes("DECLARATIA UNICA") ||
    dUpper.includes("DECLARAȚIA UNICĂ") ||
    dUpper.includes("DECLARATIE UNICA") ||
    dUpper.includes("DECLARAȚIE UNICĂ")
  ) {
    return tUpper === "DECLARATIE"
      ? "Declarația Unică 212 — Persoane Fizice"
      : "Recipisă Declarația Unică 212 — Persoane Fizice";
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
  if (dUpper.includes("POPRIR")) {
    return "Adresă Înființare / Ridicare Poprire ANAF";
  }
  if (tUpper === "ADRESE") {
    return "Adresă Oficială ANAF";
  }
  if (tUpper === "NOTIFICARE" || dUpper.includes("NOTIFICARE")) {
    return "Notificare Oficială ANAF";
  }
  return tip ? `Document SPV — ${tip}` : "Document Oficial SPV ANAF";
}

/**
 * Extrage perioada fiscală din textul detaliilor
 */
export function extractPerioadaFiscala(detalii: string): string | null {
  const m = detalii.match(/perioada(?:\s+raportare)?\s+([0-9]{1,2}\.[0-9]{4})/i);
  if (m && m[1]) return m[1];
  const mYear = detalii.match(/(?:anul|an)\s+([0-9]{4})/i);
  if (mYear && mYear[1]) return `12.${mYear[1]}`;
  return null;
}

/**
 * Serviciul OAuth 2.0 ANAF (api.anaf.ro) nu acoperă webserviciul clasic SPVWS2 (care necesită mTLS cu certificat fizic).
 */
export async function syncSpvPortalDocumentsForTenant(
  _tenantId: number,
  _apiKey?: string,
  _fetchFn?: typeof fetch
): Promise<SyncPortalResult> {
  return {
    success: true,
    imported: 0,
    total: 0,
    needsSpvRole: false,
    message:
      "Serviciul OAuth ANAF acoperă exclusiv RO e-Factura; documentele din portalul SPV necesită fișierul PDF/ZIP original semnat de ANAF.",
  };
}
