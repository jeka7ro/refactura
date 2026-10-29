import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { format } from "date-fns";
import * as schema from "../drizzle/schema";
import iconv from "iconv-lite";
import {
  type CandidateArticle,
  computeNext088Seq,
  findBestArticleMatch,
  formatAppArticleCode,
  isAppGeneratedArticleCode,
} from "../shared/articleMatcher";

/**
 * Asigură codificarea corectă Windows-1250 pentru fișierele XML destinate SAGA C:
 * 1. Normalizează diacriticele românești cu virgulă la cele cu sedilă compatibile Windows-1250 (FoxPro)
 * 2. Convertește conținutul la un Buffer în codepage-ul Windows-1250 real
 */
export function toSagaXmlBuffer(xmlString: string): Buffer {
  const normalized = xmlString
    .replace(/Ș/g, "\u015E")
    .replace(/ș/g, "\u015F")
    .replace(/Ț/g, "\u0162")
    .replace(/ț/g, "\u0163");

  try {
    return iconv.encode(normalized, "windows-1250");
  } catch {
    return Buffer.from(normalized, "utf8");
  }
}

/**
 * Detectează codul țării din CUI sau returnează RO ca fallback
 */
export function detectCountryFromCui(cui?: string | null): string {
  if (!cui) return "RO";
  const clean = cui.trim().toUpperCase();
  const match = clean.match(/^([A-Z]{2})/);
  if (match && match[1] !== "RO") return match[1];
  return "RO";
}

export function normalizeSagaUm(rawUnit?: string | null): string {
  const trimmed = (rawUnit || "").trim();
  if (!trimmed) return "buc";
  const upper = trimmed.toUpperCase();
  const map: Record<string, string> = {
    H87: "buc",
    C62: "buc",
    EA: "buc",
    PCE: "buc",
    NMP: "buc",
    XPP: "buc",
    NAR: "buc",
    BUC: "buc",
    "BUC.": "buc",
    KGM: "kg",
    KG: "kg",
    GRM: "g",
    TNE: "t",
    LTR: "l",
    MLT: "ml",
    MTR: "m",
    CMT: "cm",
    MMT: "mm",
    MTK: "mp",
    MTQ: "mc",
    SET: "set",
    HUR: "oră",
    BX: "cutie",
    XBX: "cutie",
    RO: "rolă",
    XRO: "rolă",
    PK: "pachet",
    XPK: "pachet",
    PR: "per",
    BG: "sac",
    XBG: "sac",
  };
  return map[upper] || trimmed;
}

export interface EnrichedArticleState {
  articles: CandidateArticle[];
  byId: Map<number, CandidateArticle>;
  byCode: Map<string, CandidateArticle>;
  next088Seq: number;
}

export async function loadEnrichedSagaArticles(
  db: any,
  tenantId: number
): Promise<EnrichedArticleState> {
  const { sagaArticles, sagaIntrari, sagaIntrariLinii } = await import("../modules/saga/schema");
  const rawArticles = await db
    .select()
    .from(sagaArticles)
    .where(and(eq(sagaArticles.tenantId, tenantId), eq(sagaArticles.isActive, 1)));

  const priceByArticleId = new Map<number, Set<number>>();
  const priceByCode = new Map<string, Set<number>>();

  try {
    const nirPriceRows = await db
      .select({
        sagaArticleId: schema.nirLines.sagaArticleId,
        unitPrice: schema.nirLines.unitPrice,
      })
      .from(schema.nirLines)
      .innerJoin(schema.nir, eq(schema.nir.id, schema.nirLines.nirId))
      .where(eq(schema.nir.tenantId, tenantId));

    for (const r of nirPriceRows) {
      if (!r.sagaArticleId) continue;
      const p = parseFloat(String(r.unitPrice || "0"));
      if (isNaN(p) || p <= 0) continue;
      const rounded = Math.round(p * 10000) / 10000;
      if (!priceByArticleId.has(r.sagaArticleId)) {
        priceByArticleId.set(r.sagaArticleId, new Set());
      }
      priceByArticleId.get(r.sagaArticleId)!.add(rounded);
    }

    const intrariPriceRows = await db
      .select({
        cod: sagaIntrariLinii.cod,
        pretUnitar: sagaIntrariLinii.pretUnitar,
      })
      .from(sagaIntrariLinii)
      .innerJoin(sagaIntrari, eq(sagaIntrari.id, sagaIntrariLinii.intrareId))
      .where(eq(sagaIntrari.tenantId, tenantId));

    for (const r of intrariPriceRows) {
      const code = String(r.cod || "").trim();
      if (!code) continue;
      const p = parseFloat(String(r.pretUnitar || "0"));
      if (isNaN(p) || p <= 0) continue;
      const rounded = Math.round(p * 10000) / 10000;
      if (!priceByCode.has(code)) {
        priceByCode.set(code, new Set());
      }
      priceByCode.get(code)!.add(rounded);
    }
  } catch (e) {
    console.warn("[loadEnrichedSagaArticles] price enrichment warning:", e);
  }

  const articles: CandidateArticle[] = rawArticles.map((art: any) => {
    const prices = new Set<number>();
    const byIdSet = priceByArticleId.get(art.id);
    if (byIdSet) byIdSet.forEach((p) => prices.add(p));
    const byCodeSet = priceByCode.get(String(art.code || "").trim());
    if (byCodeSet) byCodeSet.forEach((p) => prices.add(p));
    const knownPrices = Array.from(prices);
    return {
      id: art.id,
      code: String(art.code || "").trim(),
      name: String(art.name || "").trim(),
      unit: art.unit,
      accountingAccount: art.accountingAccount,
      category: art.category,
      vatRate: art.vatRate,
      knownPrices,
      lastPrice: knownPrices.length > 0 ? knownPrices[knownPrices.length - 1] : null,
    };
  });

  const byId = new Map<number, CandidateArticle>();
  const byCode = new Map<string, CandidateArticle>();
  for (const a of articles) {
    if (a.id) byId.set(a.id, a);
    if (a.code) byCode.set(a.code, a);
  }

  const next088Seq = computeNext088Seq(articles.map((a) => a.code));
  return { articles, byId, byCode, next088Seq };
}

export async function resolveOrCreateArticleForLine(
  db: any,
  tenantId: number,
  lineInput: {
    description?: string | null;
    unit?: string | null;
    unitPrice?: number | string | null;
    vatRate?: number | string | null;
    accountingType?: string | null;
    accountingAccount?: string | null;
    sagaArticleId?: number | null;
    articleCode?: string | null;
  },
  state: EnrichedArticleState,
  options?: { persistToDb?: boolean; nirLineId?: number }
): Promise<{
  sagaArticleId?: number;
  articleCode?: string;
  matchType: "exact" | "words_and_price" | "new_088" | "new_custom" | "none";
  matchedWords?: string[];
  matchedPrice?: number | null;
  matchedArticle?: CandidateArticle;
}> {
  const persistToDb = options?.persistToDb !== false;
  const acc = String(lineInput.accountingAccount || "371").trim();
  const isServiceOrAdvance =
    acc.startsWith("6") ||
    acc.startsWith("7") ||
    acc.startsWith("409") ||
    lineInput.accountingType === "Servicii" ||
    lineInput.accountingType === "Avans";

  if (isServiceOrAdvance) {
    return { matchType: "none" };
  }

  const parsedPrice = parseFloat(String(lineInput.unitPrice ?? "0"));
  const validPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? Math.round(parsedPrice * 10000) / 10000 : null;

  // 1. Existing sagaArticleId
  if (lineInput.sagaArticleId && state.byId.has(lineInput.sagaArticleId)) {
    const art = state.byId.get(lineInput.sagaArticleId)!;
    if (validPrice && art.knownPrices && !art.knownPrices.includes(validPrice)) {
      art.knownPrices.push(validPrice);
    }
    return {
      sagaArticleId: art.id,
      articleCode: art.code,
      matchType: "exact",
      matchedArticle: art,
    };
  }

  const { sagaArticles } = await import("../modules/saga/schema");
  const cleanExplicitCode = String(lineInput.articleCode || "").trim();

  // 2. Explicit articleCode provided by user/frontend
  if (cleanExplicitCode) {
    const existingByCode = state.byCode.get(cleanExplicitCode);
    if (existingByCode) {
      if (validPrice && existingByCode.knownPrices && !existingByCode.knownPrices.includes(validPrice)) {
        existingByCode.knownPrices.push(validPrice);
      }
      if (persistToDb && options?.nirLineId && existingByCode.id) {
        await db
          .update(schema.nirLines)
          .set({ sagaArticleId: existingByCode.id })
          .where(eq(schema.nirLines.id, options.nirLineId));
      }
      return {
        sagaArticleId: existingByCode.id,
        articleCode: existingByCode.code,
        matchType: isAppGeneratedArticleCode(existingByCode.code) ? "new_088" : "exact",
        matchedArticle: existingByCode,
      };
    }

    // Create new article with the explicit code
    let newId = -state.next088Seq;
    const normUm = normalizeSagaUm(lineInput.unit);
    if (persistToDb) {
      const [ins] = await db.insert(sagaArticles).values({
        tenantId,
        code: cleanExplicitCode,
        name: (lineInput.description || `Articol ${cleanExplicitCode}`).trim(),
        unit: normUm,
        vatRate: String(lineInput.vatRate || "21"),
        category: lineInput.accountingType || "Marfuri",
        accountingAccount: acc || "371",
        sagaCode: cleanExplicitCode,
        isActive: 1,
      });
      newId = (ins as any).insertId;
      if (options?.nirLineId && newId > 0) {
        await db
          .update(schema.nirLines)
          .set({ sagaArticleId: newId })
          .where(eq(schema.nirLines.id, options.nirLineId));
      }
    }
    const createdArt: CandidateArticle = {
      id: newId,
      code: cleanExplicitCode,
      name: (lineInput.description || `Articol ${cleanExplicitCode}`).trim(),
      unit: normUm,
      accountingAccount: acc || "371",
      category: lineInput.accountingType || "Marfuri",
      vatRate: String(lineInput.vatRate || "21"),
      knownPrices: validPrice ? [validPrice] : [],
      lastPrice: validPrice,
    };
    state.articles.push(createdArt);
    if (newId) state.byId.set(newId, createdArt);
    state.byCode.set(cleanExplicitCode, createdArt);
    const nextCandidateSeq = computeNext088Seq([cleanExplicitCode]);
    if (nextCandidateSeq > state.next088Seq) state.next088Seq = nextCandidateSeq;

    return {
      sagaArticleId: newId > 0 ? newId : undefined,
      articleCode: cleanExplicitCode,
      matchType: isAppGeneratedArticleCode(cleanExplicitCode) ? "new_088" : "new_custom",
      matchedArticle: createdArt,
    };
  }

  // 3. Smart match against existing articles (exact name OR >= 2 words + same unit price)
  const smartMatch = findBestArticleMatch(
    lineInput.description || "",
    lineInput.unitPrice,
    state.articles
  );

  if (smartMatch) {
    const art = smartMatch.article;
    if (validPrice && art.knownPrices && !art.knownPrices.includes(validPrice)) {
      art.knownPrices.push(validPrice);
    }
    if (persistToDb && options?.nirLineId && art.id && art.id > 0) {
      await db
        .update(schema.nirLines)
        .set({ sagaArticleId: art.id })
        .where(eq(schema.nirLines.id, options.nirLineId));
    }
    return {
      sagaArticleId: art.id > 0 ? art.id : undefined,
      articleCode: art.code,
      matchType: smartMatch.matchType,
      matchedWords: smartMatch.matchedWords,
      matchedPrice: smartMatch.matchedPrice,
      matchedArticle: art,
    };
  }

  // 4. Allocate next 088xxxxx code for this new stock article
  let allocatedCode = formatAppArticleCode(state.next088Seq++);
  while (state.byCode.has(allocatedCode)) {
    allocatedCode = formatAppArticleCode(state.next088Seq++);
  }

  let newId = -state.next088Seq;
  const normUm = normalizeSagaUm(lineInput.unit);
  const cleanName = (lineInput.description || `Articol ${allocatedCode}`).trim();

  if (persistToDb) {
    const [ins] = await db.insert(sagaArticles).values({
      tenantId,
      code: allocatedCode,
      name: cleanName,
      unit: normUm,
      vatRate: String(lineInput.vatRate || "21"),
      category: lineInput.accountingType || "Marfuri",
      accountingAccount: acc || "371",
      sagaCode: allocatedCode,
      isActive: 1,
    });
    newId = (ins as any).insertId;
    if (options?.nirLineId && newId > 0) {
      await db
        .update(schema.nirLines)
        .set({ sagaArticleId: newId })
        .where(eq(schema.nirLines.id, options.nirLineId));
    }
  }

  const createdArt: CandidateArticle = {
    id: newId,
    code: allocatedCode,
    name: cleanName,
    unit: normUm,
    accountingAccount: acc || "371",
    category: lineInput.accountingType || "Marfuri",
    vatRate: String(lineInput.vatRate || "21"),
    knownPrices: validPrice ? [validPrice] : [],
    lastPrice: validPrice,
  };
  state.articles.push(createdArt);
  if (newId) state.byId.set(newId, createdArt);
  state.byCode.set(allocatedCode, createdArt);

  return {
    sagaArticleId: newId > 0 ? newId : undefined,
    articleCode: allocatedCode,
    matchType: "new_088",
    matchedArticle: createdArt,
  };
}

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

  const isTradeInvest = tenant?.name?.toLowerCase().includes("trade invest") || tenantId === 1 || tenantId === 9;

  return {
    name: tenant?.name || (isTradeInvest ? "TRADE INVEST NETWORK S.R.L." : "Companie"),
    cui: tenant?.cui?.trim() || settings.cui?.trim() || (isTradeInvest ? "RO42322117" : ""),
    regCom: settings.regCom?.trim() || settings.rc?.trim() || (isTradeInvest ? "J2020002825409" : ""),
    country: settings.country || "RO",
    county: settings.county || (isTradeInvest ? "B" : ""),
    city: settings.city || (isTradeInvest ? "Bucuresti" : ""),
    address: settings.address || tenant?.address || (isTradeInvest ? "MUNICIPIUL BUCUREŞTI, SECTOR 1, STR POPA SAVU, NR.78" : "Bucuresti"),
    phone: tenant?.phone || settings.phone || "",
    email: tenant?.email || settings.email || "",
    bank: settings.bank || (isTradeInvest ? "Unicredit" : ""),
    iban: settings.iban || (isTradeInvest ? "RO31BACX0000001999343001" : ""),
  };
}

export function formatSpvTags(spvIndex: string): string {
  if (!spvIndex || !spvIndex.trim()) return "";
  const s = escapeXml(spvIndex.trim());
  return [
    `      <IdIncarcareSPV>${s}</IdIncarcareSPV>`,
    `      <Observatii>ID încărcare SPV: ${s}</Observatii>`,
  ].join("\n") + "\n";
}

export function resolveSagaLineTip(
  lineAccountingType?: string | null,
  lineAccount?: string | null,
  fallbackAccountingType?: string | null
): string {
  const rawType = String(lineAccountingType || fallbackAccountingType || "").trim();
  const lower = rawType.toLowerCase();
  const acc = String(lineAccount || "").trim();

  // 1. Normalizare după denumirea tipului explicit ales de utilizator
  if (lower.includes("materii prime") || lower.includes("materie prima")) return "Materii prime";
  if (lower.includes("materiale auxiliare") || lower.includes("auxiliar")) return "Materiale auxiliare";
  if (lower.includes("piese de schimb")) return "Piese de schimb";
  if (lower.includes("combustibil")) return "Combustibili";
  if (lower.includes("obiecte de inventar") || lower.includes("inventar")) return "Obiecte de inventar";
  if (lower.includes("produse finite")) return "Produse finite";
  if (lower.includes("semifabricate")) return "Semifabricate";
  if (lower.includes("ambalaj")) return "Ambalaje";
  if (lower.includes("servici") || lower.includes("avans") || lower.includes("utilitati") || lower.includes("manopera") || lower.includes("transport") || lower.includes("protocol") || lower.includes("reclama")) return "Servicii";
  if (lower.includes("alte mat") || lower.includes("alte consumabile")) return "Alte mat. consumabile";
  if (lower.includes("consumabil") || lower.includes("materiale consumabile")) return "Materiale consumabile";
  if (lower.includes("marfuri") || lower.includes("marfa")) return "Marfuri";

  // 2. Mappings by accounting account (standard Plan de Conturi General Romania)
  if (acc.startsWith("301")) return "Materii prime";
  if (acc.startsWith("3021")) return "Materiale auxiliare";
  if (acc.startsWith("3022")) return "Combustibili";
  if (acc.startsWith("3024")) return "Piese de schimb";
  if (acc.startsWith("3028")) return "Alte mat. consumabile";
  if (acc.startsWith("302")) return "Materiale consumabile";
  if (acc.startsWith("303")) return "Obiecte de inventar";
  if (acc.startsWith("371")) return "Marfuri";
  if (acc.startsWith("345")) return "Produse finite";
  if (acc.startsWith("341")) return "Semifabricate";
  if (acc.startsWith("381")) return "Ambalaje";
  if (acc.startsWith("6") || acc.startsWith("7") || acc.startsWith("409")) return "Servicii";

  return rawType || "Materii prime";
}

export async function resolveNirSpvData(db: any, n: any) {
  let spvIndex = "";
  let docDate = n.receiptDate;
  let dueDate = "";
  let archiveTotal: number | null = null;
  let archiveTotalVat: number | null = null;

  let currency = n.currency || "RON";
  let exchangeRate = parseFloat(String(n.exchangeRate || "1")) || 1;

  if (n.invoiceArchiveId) {
    const [inv] = await db
      .select()
      .from(schema.invoiceArchive)
      .where(eq(schema.invoiceArchive.id, n.invoiceArchiveId));
    if (inv) {
      if (inv.currency && inv.currency.trim()) currency = inv.currency.trim().toUpperCase();
      if (inv.issueDate) docDate = inv.issueDate;
      if (inv.dueDate) dueDate = inv.dueDate;
      if (inv.total) archiveTotal = parseFloat(String(inv.total));
      if (inv.totalVAT) archiveTotalVat = parseFloat(String(inv.totalVAT));
      if (inv.spvIndex) {
        spvIndex = inv.spvIndex;
      } else if (inv.notes) {
        const m = inv.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i);
        if (m) spvIndex = m[1];
      }
      if (!spvIndex && inv.fileName) {
        const m = inv.fileName.match(/(?:SPV_|_INDEX_|id_|index_)(\d{8,12})/i);
        if (m) spvIndex = m[1];
      }
    }
  }

  if (!spvIndex && n.invoiceNumber) {
    const invs = await db
      .select()
      .from(schema.invoiceArchive)
      .where(
        and(
          eq(schema.invoiceArchive.tenantId, n.tenantId),
          eq(schema.invoiceArchive.invoiceNumber, n.invoiceNumber)
        )
      );
    for (const inv of invs) {
      if (inv.currency && inv.currency.trim()) currency = inv.currency.trim().toUpperCase();
      if (inv.issueDate && (!docDate || docDate === n.receiptDate)) docDate = inv.issueDate;
      if (inv.dueDate && !dueDate) dueDate = inv.dueDate;
      if (archiveTotal === null && inv.total) archiveTotal = parseFloat(String(inv.total));
      if (archiveTotalVat === null && inv.totalVAT) archiveTotalVat = parseFloat(String(inv.totalVAT));
      if (inv.spvIndex) { spvIndex = inv.spvIndex; break; }
      if (inv.notes) {
        const m = inv.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i);
        if (m) { spvIndex = m[1]; break; }
      }
    }
  }

  const { sagaIntrari } = await import("../modules/saga/schema");
  let [si] = await db
    .select()
    .from(sagaIntrari)
    .where(and(eq(sagaIntrari.tenantId, n.tenantId), eq(sagaIntrari.nirId, n.id)));
  if (!si && n.invoiceNumber) {
    const cands = await db
      .select()
      .from(sagaIntrari)
      .where(and(eq(sagaIntrari.tenantId, n.tenantId), eq(sagaIntrari.nrDoc, n.invoiceNumber)));
    const norm = (x: any) => String(x || "").replace(/\D/g, "");
    const nirCui = norm(n.supplierCUI);
    // Doar dacă furnizorul coincide (sau nu putem determina furnizorul și există un singur candidat)
    si = cands.find((c: any) => nirCui && norm(c.cuiFurnizor) === nirCui)
      || (!nirCui && cands.length === 1 ? cands[0] : undefined);
  }

  if (si) {
    if (si.valuta && si.valuta.trim()) currency = si.valuta.trim().toUpperCase();
    if (si.curs) exchangeRate = parseFloat(String(si.curs)) || exchangeRate;
    if (currency !== "RON" && currency !== "LEI" && si.totalValuta) {
      archiveTotal = parseFloat(String(si.totalValuta));
      if (si.tvaValuta) archiveTotalVat = parseFloat(String(si.tvaValuta));
    }
    if (!spvIndex && si.idSPV) spvIndex = si.idSPV;
    if (si.data && (!docDate || docDate === n.receiptDate)) docDate = si.data;
    if (si.scadent && !dueDate) dueDate = si.scadent;
    if (archiveTotal === null && si.total) archiveTotal = parseFloat(String(si.total));
    if (archiveTotalVat === null && si.tva) archiveTotalVat = parseFloat(String(si.tva));
  }

  if (!spvIndex && n.notes) {
    const m = n.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i);
    if (m) spvIndex = m[1];
  }

  return { spvIndex, docDate, dueDate, archiveTotal, archiveTotalVat, currency, exchangeRate };
}

/**
 * Generează XML de Facturi (<Facturi>) conform specificațiilor oficiale SAGA C și SAGA Web API.
 * 
 * Regula SAGA:
 * - Dacă FurnizorCIF reprezintă CIF-ul societății -> import în Ieșiri (Facturi Emise/Vânzări)
 * - Dacă ClientCIF reprezintă CIF-ul societății -> import în Intrări (Achiziții/NIR)
 */
export async function generateSagaExportXML(
  tenantId: number,
  month: number,
  year: number,
  options?: {
    nirIds?: number[];
    invoiceIds?: number[];
  }
) {
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

  let monthInvoices = invoices.filter((inv) => {
    if (!inv.issueDate) return false;
    const invDate = inv.issueDate.substring(0, 10);
    return invDate >= startDateStr && invDate <= endDateStr;
  });

  if (options?.invoiceIds !== undefined) {
    monthInvoices = monthInvoices.filter((inv) => options.invoiceIds!.includes(inv.id));
  }

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
    const furnizorBanca = (inv as any).companyBank || company.bank;
    const furnizorIban = (inv as any).companyIBAN || company.iban;
    if (furnizorBanca) xml += `      <FurnizorBanca>${escapeXml(furnizorBanca)}</FurnizorBanca>\n`;
    if (furnizorIban) xml += `      <FurnizorIBAN>${escapeXml(furnizorIban)}</FurnizorIBAN>\n`;

    // Clientul (cu date complete din factură sau din profilul de client, și codul SAGA asociat)
    const clientName = inv.clientName || client?.name || "Client";
    const clientCif = inv.clientCUI || client?.cui || "";
    const clientRegCom = (inv as any).clientRegCom || client?.regCom || "";
    const clientCounty = (inv as any).clientCounty || (client as any)?.county || "";
    const clientCountry = inv.clientCountry || (client as any)?.country || detectCountryFromCui(clientCif);
    const clientCity = inv.clientCity || client?.city || "";
    const clientAddress = inv.clientAddress || client?.address || "";
    const clientBank = (client as any)?.bank || "";
    const clientIban = (client as any)?.iban || "";
    const clientPhone = inv.clientPhone || client?.phone || "";
    const clientMail = inv.clientEmail || client?.email || "";

    const clientCode = (inv as any).clientCode || (client?.sagaCode && client.sagaCode !== "null" ? client.sagaCode : null) || client?.id;
    if (clientCode) xml += `      <ClientCod>${escapeXml(clientCode)}</ClientCod>\n`;
    xml += `      <ClientNume>${escapeXml(clientName)}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(clientCif)}</ClientCIF>\n`;
    if (clientRegCom) xml += `      <ClientNrRegCom>${escapeXml(clientRegCom)}</ClientNrRegCom>\n`;
    if (clientCounty) xml += `      <ClientJudet>${escapeXml(clientCounty)}</ClientJudet>\n`;
    xml += `      <ClientTara>${escapeXml(clientCountry || "RO")}</ClientTara>\n`;
    if (clientCity) xml += `      <ClientLocalitate>${escapeXml(clientCity)}</ClientLocalitate>\n`;
    if (clientAddress) xml += `      <ClientAdresa>${escapeXml(clientAddress)}</ClientAdresa>\n`;
    if (clientBank) xml += `      <ClientBanca>${escapeXml(clientBank)}</ClientBanca>\n`;
    if (clientIban) xml += `      <ClientIBAN>${escapeXml(clientIban)}</ClientIBAN>\n`;
    if (clientPhone) xml += `      <ClientTelefon>${escapeXml(clientPhone)}</ClientTelefon>\n`;
    if (clientMail) xml += `      <ClientMail>${escapeXml(clientMail)}</ClientMail>\n`;

    // Date factură & totaluri
    let totalValoare = 0;
    let totalTva = 0;
    const processedLines = lines.map((line) => {
      const qty = parseFloat(String(line.quantity)) || 0;
      const price = parseFloat(String(line.unitPrice)) || 0;
      const rate = parseFloat(String(line.vatRate)) || 0;
      const rawTotal = parseFloat(String(line.total));
      const lineVal = (!isNaN(rawTotal) && rawTotal !== 0)
        ? rawTotal
        : Math.round(qty * price * 100) / 100;
      const lineVat = Math.round(lineVal * (rate / 100) * 100) / 100;
      const lineTotal = Math.round((lineVal + lineVat) * 100) / 100;

      totalValoare += lineVal;
      totalTva += lineVat;

      return { line, qty, price, rate, lineVal, lineVat, lineTotal };
    });

    totalValoare = Math.round(totalValoare * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    let totalFactura = Math.round((totalValoare + totalTva) * 100) / 100;

    const rawInvTotal = parseFloat(String(inv.total));
    if (!isNaN(rawInvTotal) && rawInvTotal !== 0) {
      totalFactura = rawInvTotal;
    }

    if (inv.series) {
      xml += `      <FacturaSerie>${escapeXml(inv.series)}</FacturaSerie>\n`;
    }
    xml += `      <FacturaNumar>${escapeXml(inv.number)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(inv.issueDate)}</FacturaData>\n`;
    if (inv.dueDate) {
      xml += `      <FacturaScadenta>${formatDate(inv.dueDate)}</FacturaScadenta>\n`;
    }
    xml += `      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>\n`;
    xml += `      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>\n`;
    xml += `      <FacturaTip></FacturaTip>\n`;
    xml += `      <FacturaMoneda>${escapeXml(inv.currency || "RON")}</FacturaMoneda>\n`;
    xml += `      <FacturaTotalValoare>${totalValoare.toFixed(2)}</FacturaTotalValoare>\n`;
    xml += `      <FacturaTotalTVA>${totalTva.toFixed(2)}</FacturaTotalTVA>\n`;
    xml += `      <FacturaTotal>${totalFactura.toFixed(2)}</FacturaTotal>\n`;
    if (inv.spvIndex) {
      xml += formatSpvTags(inv.spvIndex);
    }
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const item of processedLines) {
      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      xml += `          <Tip>Servicii</Tip>\n`;
      xml += `          <Descriere>${escapeXml(item.line.description)}</Descriere>\n`;
      if (item.line.devizCode) {
        xml += `          <CodArticolClient>${escapeXml(item.line.devizCode)}</CodArticolClient>\n`;
      }
      xml += `          <UM>${escapeXml(normalizeSagaUm(item.line.unit))}</UM>\n`;
      xml += `          <Cantitate>${item.qty}</Cantitate>\n`;
      xml += `          <Pret>${item.price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${item.lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${item.rate}</ProcTVA>\n`;
      xml += `          <TVA>${item.lineVat.toFixed(2)}</TVA>\n`;
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

  let monthNirs = nirList.filter((n) => {
    if (!n.receiptDate) return false;
    const nDate = n.receiptDate.substring(0, 10);
    return nDate >= startDateStr && nDate <= endDateStr;
  });

  if (options?.nirIds !== undefined) {
    monthNirs = monthNirs.filter((n) => options.nirIds!.includes(n.id));
  }

  // Urmărim cheile unice de document (CUI_NrFactura) pentru a preveni exportul duplicat
  const exportedDocKeys = new Set<string>();
  const articleState = await loadEnrichedSagaArticles(db, tenantId);

  // a. Facturi Intrări din modulul NIR
  for (const n of monthNirs) {
    const cleanSupplierCui = (n.supplierCUI || "").replace(/^RO/i, "").trim().toUpperCase();
    const docNum = (n.invoiceNumber || n.nirNumber || "").trim().toUpperCase();
    const docKey = `${cleanSupplierCui}_${docNum}`;
    if (docKey && exportedDocKeys.has(docKey)) continue;
    if (docKey) exportedDocKeys.add(docKey);

    const linesData = await db
      .select({
        line: schema.nirLines,
        articleCode: sagaArticles.code,
      })
      .from(schema.nirLines)
      .leftJoin(
        sagaArticles,
        and(eq(schema.nirLines.sagaArticleId, sagaArticles.id), eq(sagaArticles.tenantId, tenantId))
      )
      .where(eq(schema.nirLines.nirId, n.id));

    // Preia datele reale ale facturii (data emiterii furnizorului și index SPV)
    const { spvIndex, docDate, dueDate, archiveTotal, archiveTotalVat, currency, exchangeRate } = await resolveNirSpvData(db, n);

    let totalValoare = 0;
    let totalTva = 0;

    const processedLines = [];
    for (const row of linesData) {
      const line = row.line;
      const lineAcc = String(line.accountingAccount || n.accountingAccount || "371").trim();
      const isServiceOrAdvance = lineAcc.startsWith("6") || lineAcc.startsWith("7") || lineAcc.startsWith("409") || (line as any).accountingType === "Servicii" || (line as any).accountingType === "Avans";

      let code = row.articleCode;
      if (!code && !isServiceOrAdvance) {
        const resolved = await resolveOrCreateArticleForLine(
          db,
          tenantId,
          {
            description: line.description,
            unit: line.unit,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            accountingType: line.accountingType || n.accountingType,
            accountingAccount: lineAcc,
            sagaArticleId: line.sagaArticleId,
          },
          articleState,
          { persistToDb: true, nirLineId: line.id }
        );
        code = resolved.articleCode || null;
      }

      let qty = parseFloat(String(line.cantitateReceptionata)) || 0;
      let price = parseFloat(String(line.unitPrice)) || 0;
      const rate = parseFloat(String(line.vatRate)) || 0;

      const rawTotal = parseFloat(String(line.total));
      let lineVal = (!isNaN(rawTotal) && rawTotal !== 0)
        ? rawTotal
        : Math.round(qty * price * 100) / 100;

      // Consistență SAGA: Cantitate * Pret = Valoare
      // Dacă Valoarea este negativă (discount/storno), cantitatea sau prețul trebuie să reflecte semnul negativ
      if (lineVal < 0) {
        if (qty > 0 && price > 0) {
          qty = -qty;
        } else if (qty > 0 && price === 0) {
          qty = -qty;
          price = Math.abs(lineVal);
        }
      } else if (lineVal > 0) {
        qty = Math.abs(qty);
        price = Math.abs(price);
      }

      // TVA-ul liniei are obligatoriu același semn ca Valoarea
      let lineVat = Math.round(lineVal * (rate / 100) * 100) / 100;
      if (lineVal < 0 && lineVat > 0) lineVat = -lineVat;
      if (lineVal > 0 && lineVat < 0) lineVat = Math.abs(lineVat);
      const lineTotal = Math.round((lineVal + lineVat) * 100) / 100;

      totalValoare += lineVal;
      totalTva += lineVat;

      processedLines.push({
        line,
        code,
        qty,
        price,
        rate,
        lineVal,
        lineVat,
        lineTotal,
        lineAcc,
        isServiceOrAdvance,
      });
    }

    totalValoare = Math.round(totalValoare * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    let totalFactura = Math.round((totalValoare + totalTva) * 100) / 100;

    // Aliniem cu totalul facturii doar pentru diferențe de rotunjire (recepție parțială / prețuri modificate = se păstrează suma liniilor)
    if (archiveTotal && !isNaN(archiveTotal) && Math.abs(Math.abs(archiveTotal) - Math.abs(totalFactura)) <= 0.15) {
      totalFactura = archiveTotal;
      if (archiveTotalVat !== null && !isNaN(archiveTotalVat)) {
        totalTva = totalFactura < 0 ? -Math.abs(archiveTotalVat) : Math.abs(archiveTotalVat);
        totalValoare = Math.round((totalFactura - totalTva) * 100) / 100;
      }
    }

    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    // Furnizorul
    const supplierCountry = detectCountryFromCui(n.supplierCUI);
    xml += `      <FurnizorNume>${escapeXml(n.supplierName || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.supplierCUI || "")}</FurnizorCIF>\n`;
    xml += `      <FurnizorTara>${escapeXml(supplierCountry)}</FurnizorTara>\n`;

    // Clientul suntem NOI
    xml += `      <ClientNume>${escapeXml(company.name)}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(company.cui)}</ClientCIF>\n`;
    if (company.regCom) xml += `      <ClientNrRegCom>${escapeXml(company.regCom)}</ClientNrRegCom>\n`;
    if (company.county) xml += `      <ClientJudet>${escapeXml(company.county)}</ClientJudet>\n`;
    xml += `      <ClientTara>${escapeXml(company.country || "RO")}</ClientTara>\n`;
    if (company.city) xml += `      <ClientLocalitate>${escapeXml(company.city)}</ClientLocalitate>\n`;
    if (company.address) xml += `      <ClientAdresa>${escapeXml(company.address)}</ClientAdresa>\n`;

    // Date document intrare (folosim data reala a facturii furnizorului, nu data receptiei/importului)
    xml += `      <FacturaNumar>${escapeXml(n.invoiceNumber || n.nirNumber)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(docDate)}</FacturaData>\n`;
    if (dueDate) {
      xml += `      <FacturaScadenta>${formatDate(dueDate)}</FacturaScadenta>\n`;
    }
    xml += `      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>\n`;
    xml += `      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>\n`;
    xml += `      <FacturaTip></FacturaTip>\n`;
    xml += `      <FacturaMoneda>${escapeXml(currency || "RON")}</FacturaMoneda>\n`;
    if (currency && currency !== "RON" && currency !== "LEI" && exchangeRate && exchangeRate > 0) {
      xml += `      <FacturaCurs>${exchangeRate.toFixed(4)}</FacturaCurs>\n`;
    }
    xml += `      <FacturaTotalValoare>${totalValoare.toFixed(2)}</FacturaTotalValoare>\n`;
    xml += `      <FacturaTotalTVA>${totalTva.toFixed(2)}</FacturaTotalTVA>\n`;
    xml += `      <FacturaTotal>${totalFactura.toFixed(2)}</FacturaTotal>\n`;
    if (spvIndex) {
      xml += formatSpvTags(spvIndex);
    }
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const item of processedLines) {
      const lineTip = resolveSagaLineTip((item.line as any).accountingType, item.lineAcc, n.accountingType);
      let lineAcc = item.lineAcc;
      if (lineTip === "Materii prime" && (!lineAcc || lineAcc.startsWith("371") || lineAcc.startsWith("302"))) {
        lineAcc = "301";
      } else if (lineTip === "Marfuri" && (!lineAcc || lineAcc.startsWith("301") || lineAcc.startsWith("302"))) {
        lineAcc = "371";
      } else if (lineTip === "Obiecte de inventar" && (!lineAcc || !lineAcc.startsWith("303"))) {
        lineAcc = "303";
      } else if ((lineTip === "Materiale consumabile" || lineTip === "Alte mat. consumabile") && (!lineAcc || !lineAcc.startsWith("302"))) {
        lineAcc = "3028";
      }
      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      if (n.gestiune && !item.isServiceOrAdvance) {
        xml += `          <Gestiune>${escapeXml(n.gestiune)}</Gestiune>\n`;
      }
      xml += `          <Tip>${escapeXml(lineTip)}</Tip>\n`;
      xml += `          <Descriere>${escapeXml(item.line.description)}</Descriere>\n`;
      if (item.code && !item.isServiceOrAdvance) {
        xml += `          <Cod>${escapeXml(item.code)}</Cod>\n`;
        xml += `          <CodArticol>${escapeXml(item.code)}</CodArticol>\n`;
        xml += `          <CodArticolFurnizor>${escapeXml(item.code)}</CodArticolFurnizor>\n`;
      }
      xml += `          <UM>${escapeXml(normalizeSagaUm(item.line.unit))}</UM>\n`;
      xml += `          <Cantitate>${item.qty}</Cantitate>\n`;
      xml += `          <Pret>${item.price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${item.lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${item.rate}</ProcTVA>\n`;
      xml += `          <TVA>${item.lineVat.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>${escapeXml(lineAcc)}</Cont>\n`;
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
  }

  // b. Facturi Intrări din modulul SAGA (sagaIntrari) — doar cele standalone, nelegate de un NIR deja exportat
  if (options?.nirIds === undefined) {
    const monthSagaIntrari = noileIntrari.filter((n) => {
      if (n.nirId) return false; // deja exportat prin NIR
      if (!n.data) return false;
      const nDate = n.data.substring(0, 10);
      return nDate >= startDateStr && nDate <= endDateStr;
    });

    for (const n of monthSagaIntrari) {
      const cleanFurnizorCui = (n.cuiFurnizor || "").replace(/^RO/i, "").trim().toUpperCase();
      const docNum = (n.nrDoc || "").trim().toUpperCase();
      const docKey = `${cleanFurnizorCui}_${docNum}`;
      if (docKey && exportedDocKeys.has(docKey)) continue;
      if (docKey) exportedDocKeys.add(docKey);

      const linesData = await db
        .select()
        .from(sagaIntrariLinii)
        .where(eq(sagaIntrariLinii.intrareId, n.id));

      let totalValoare = 0;
      let totalTva = 0;

      const processedLines = linesData.map((line) => {
        let qty = parseFloat(String(line.cantitate)) || 0;
        let price = parseFloat(String(line.pretUnitar)) || 0;
        const rate = parseFloat(String(line.tvaPercent)) || 0;
        let lineVal = parseFloat(String(line.valoare)) || Math.round(qty * price * 100) / 100;

        if (lineVal < 0) {
          if (qty > 0 && price > 0) qty = -qty;
          else if (qty > 0 && price === 0) { qty = -qty; price = Math.abs(lineVal); }
        } else if (lineVal > 0) {
          qty = Math.abs(qty);
          price = Math.abs(price);
        }

        let lineVat = parseFloat(String(line.tvaSuma)) || Math.round(lineVal * (rate / 100) * 100) / 100;
        if (lineVal < 0 && lineVat > 0) lineVat = -lineVat;
        if (lineVal > 0 && lineVat < 0) lineVat = Math.abs(lineVat);
        const lineTotal = parseFloat(String(line.total)) || Math.round((lineVal + lineVat) * 100) / 100;

        totalValoare += lineVal;
        totalTva += lineVat;

        const lineAcc = String(line.cont || "371").trim();
        const isServiceOrAdvance = lineAcc.startsWith("6") || lineAcc.startsWith("7") || lineAcc.startsWith("409") || (line as any).tip === "Servicii" || (line as any).tip === "Serviciu";

        return {
          line,
          qty,
          price,
          rate,
          lineVal,
          lineVat,
          lineTotal,
          lineAcc,
          isServiceOrAdvance,
        };
      });

      totalValoare = Math.round(totalValoare * 100) / 100;
      totalTva = Math.round(totalTva * 100) / 100;
      let totalFactura = Math.round((totalValoare + totalTva) * 100) / 100;

      const isValuta = (n as any).valuta && (n as any).valuta !== "RON" && (n as any).valuta !== "LEI";
      const headerTotValuta = parseFloat(String((n as any).totalValuta));
      const headerTvaValuta = parseFloat(String((n as any).tvaValuta));
      const headerValValuta = parseFloat(String((n as any).valoareValuta));

      if (isValuta && !isNaN(headerTotValuta) && headerTotValuta !== 0) {
        totalFactura = headerTotValuta;
        totalTva = !isNaN(headerTvaValuta) ? (totalFactura < 0 ? -Math.abs(headerTvaValuta) : Math.abs(headerTvaValuta)) : 0;
        totalValoare = !isNaN(headerValValuta) ? headerValValuta : Math.round((totalFactura - totalTva) * 100) / 100;
      } else {
        const headerVal = parseFloat(String(n.valoare));
        const headerTva = parseFloat(String(n.tva));
        const headerTot = parseFloat(String(n.total));
        if (!isNaN(headerTot) && headerTot !== 0) {
          totalFactura = headerTot;
          if (!isNaN(headerTva)) {
            totalTva = totalFactura < 0 ? -Math.abs(headerTva) : Math.abs(headerTva);
            totalValoare = !isNaN(headerVal) && headerVal !== 0 ? headerVal : Math.round((totalFactura - totalTva) * 100) / 100;
          }
        }
      }

      xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    // Furnizorul
    const supplierCountry = detectCountryFromCui(n.cuiFurnizor);
    xml += `      <FurnizorNume>${escapeXml(n.numeFurnizor || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.cuiFurnizor || "")}</FurnizorCIF>\n`;
    xml += `      <FurnizorTara>${escapeXml(supplierCountry)}</FurnizorTara>\n`;

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
    xml += `      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>\n`;
    xml += `      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>\n`;
    const curr = (n as any).valuta || "RON";
    const curs = parseFloat(String((n as any).curs || "1")) || 1;
    xml += `      <FacturaTip></FacturaTip>\n`;
    xml += `      <FacturaMoneda>${escapeXml(curr)}</FacturaMoneda>\n`;
    if (curr !== "RON" && curr !== "LEI" && curs > 0) {
      xml += `      <FacturaCurs>${curs.toFixed(4)}</FacturaCurs>\n`;
    }
    xml += `      <FacturaTotalValoare>${totalValoare.toFixed(2)}</FacturaTotalValoare>\n`;
    xml += `      <FacturaTotalTVA>${totalTva.toFixed(2)}</FacturaTotalTVA>\n`;
    xml += `      <FacturaTotal>${totalFactura.toFixed(2)}</FacturaTotal>\n`;
    if (n.idSPV) {
      xml += formatSpvTags(n.idSPV);
    }
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const item of processedLines) {
      const lineTip = resolveSagaLineTip((item.line as any).tip, item.lineAcc);
      let lineAcc = item.lineAcc;
      if (lineTip === "Materii prime" && (!lineAcc || lineAcc.startsWith("371") || lineAcc.startsWith("302"))) {
        lineAcc = "301";
      } else if (lineTip === "Marfuri" && (!lineAcc || lineAcc.startsWith("301") || lineAcc.startsWith("302"))) {
        lineAcc = "371";
      } else if (lineTip === "Obiecte de inventar" && (!lineAcc || !lineAcc.startsWith("303"))) {
        lineAcc = "303";
      } else if ((lineTip === "Materiale consumabile" || lineTip === "Alte mat. consumabile") && (!lineAcc || !lineAcc.startsWith("302"))) {
        lineAcc = "3028";
      }
      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      xml += `          <Tip>${escapeXml(lineTip)}</Tip>\n`;
      xml += `          <Descriere>${escapeXml(item.line.denumire)}</Descriere>\n`;
      if (item.line.cod && !item.isServiceOrAdvance) {
        xml += `          <Cod>${escapeXml(item.line.cod)}</Cod>\n`;
        xml += `          <CodArticol>${escapeXml(item.line.cod)}</CodArticol>\n`;
        xml += `          <CodArticolFurnizor>${escapeXml(item.line.cod)}</CodArticolFurnizor>\n`;
      }
      xml += `          <UM>${escapeXml(normalizeSagaUm(item.line.um))}</UM>\n`;
      xml += `          <Cantitate>${item.qty}</Cantitate>\n`;
      xml += `          <Pret>${item.price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${item.lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${item.rate}</ProcTVA>\n`;
      xml += `          <TVA>${item.lineVat.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>${escapeXml(lineAcc)}</Cont>\n`;
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;
    }
  }

  xml += `</Facturi>\n`;
  return xml;
}

/**
 * Generează XML de Facturi (<Facturi>) strict pentru recepții / NIR-uri (Intrări în SAGA C)
 */
export async function generateSagaNirXML(
  tenantId: number, 
  nirId?: number | number[],
  options?: { month?: number; year?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("No DB");

  const company = await getTenantCompanyProfile(tenantId);
  const { sagaArticles } = await import("../modules/saga/schema");

  let nirs = await db
    .select()
    .from(schema.nir)
    .where(eq(schema.nir.tenantId, tenantId));

  if (nirId) {
    if (Array.isArray(nirId)) {
      const idSet = new Set(nirId);
      nirs = nirs.filter((n) => idSet.has(n.id));
    } else {
      nirs = nirs.filter((n) => n.id === nirId);
    }
  } else if (options?.month && options?.year) {
    const isAllYear = !options.month || options.month === 0;
    const startDateStr = isAllYear ? `${options.year}-01-01` : `${options.year}-${String(options.month).padStart(2, "0")}-01`;
    const lastDay = isAllYear ? 31 : new Date(options.year, options.month, 0).getDate();
    const endDateStr = isAllYear ? `${options.year}-12-31` : `${options.year}-${String(options.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    nirs = nirs.filter((n) => {
      if (!n.receiptDate) return false;
      const nDate = n.receiptDate.substring(0, 10);
      return nDate >= startDateStr && nDate <= endDateStr;
    });
  }

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n`;
  xml += `<Facturi>\n`;

  const exportedDocKeys = new Set<string>();
  const articleState = await loadEnrichedSagaArticles(db, tenantId);

  for (const n of nirs) {
    const cleanSupplierCui = (n.supplierCUI || "").replace(/^RO/i, "").trim().toUpperCase();
    const docNum = (n.invoiceNumber || n.nirNumber || "").trim().toUpperCase();
    const docKey = `${cleanSupplierCui}_${docNum}`;
    if (docKey && exportedDocKeys.has(docKey)) continue;
    if (docKey) exportedDocKeys.add(docKey);
    const linesData = await db
      .select({
        line: schema.nirLines,
        articleCode: sagaArticles.code,
      })
      .from(schema.nirLines)
      .leftJoin(
        sagaArticles,
        and(eq(schema.nirLines.sagaArticleId, sagaArticles.id), eq(sagaArticles.tenantId, tenantId))
      )
      .where(eq(schema.nirLines.nirId, n.id));

    // Preia datele reale ale facturii (data emiterii furnizorului și index SPV)
    const { spvIndex, docDate, dueDate, archiveTotal, archiveTotalVat, currency, exchangeRate } = await resolveNirSpvData(db, n);

    let totalValoare = 0;
    let totalTva = 0;

    const processedLines = [];
    for (const row of linesData) {
      const line = row.line;
      const lineAcc = String(line.accountingAccount || n.accountingAccount || "371").trim();
      const isServiceOrAdvance = lineAcc.startsWith("6") || lineAcc.startsWith("7") || lineAcc.startsWith("409") || (line as any).accountingType === "Servicii" || (line as any).accountingType === "Avans";

      let code = row.articleCode;
      if (!code && !isServiceOrAdvance) {
        const resolved = await resolveOrCreateArticleForLine(
          db,
          tenantId,
          {
            description: line.description,
            unit: line.unit,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            accountingType: line.accountingType || n.accountingType,
            accountingAccount: lineAcc,
            sagaArticleId: line.sagaArticleId,
          },
          articleState,
          { persistToDb: true, nirLineId: line.id }
        );
        code = resolved.articleCode || null;
      }

      let qty = parseFloat(String(line.cantitateReceptionata)) || 0;
      let price = parseFloat(String(line.unitPrice)) || 0;
      const rate = parseFloat(String(line.vatRate)) || 0;

      const rawTotal = parseFloat(String(line.total));
      let lineVal = (!isNaN(rawTotal) && rawTotal !== 0)
        ? rawTotal
        : Math.round(qty * price * 100) / 100;

      // Consistență SAGA: Cantitate * Pret = Valoare
      // Dacă Valoarea este negativă (discount/storno), cantitatea sau prețul trebuie să reflecte semnul negativ
      if (lineVal < 0) {
        if (qty > 0 && price > 0) {
          qty = -qty;
        } else if (qty > 0 && price === 0) {
          qty = -qty;
          price = Math.abs(lineVal);
        }
      } else if (lineVal > 0) {
        qty = Math.abs(qty);
        price = Math.abs(price);
      }

      // TVA-ul liniei are obligatoriu același semn ca Valoarea
      let lineVat = Math.round(lineVal * (rate / 100) * 100) / 100;
      if (lineVal < 0 && lineVat > 0) lineVat = -lineVat;
      if (lineVal > 0 && lineVat < 0) lineVat = Math.abs(lineVat);
      const lineTotal = Math.round((lineVal + lineVat) * 100) / 100;

      totalValoare += lineVal;
      totalTva += lineVat;

      processedLines.push({
        line,
        code,
        qty,
        price,
        rate,
        lineVal,
        lineVat,
        lineTotal,
        lineAcc,
        isServiceOrAdvance,
      });
    }

    totalValoare = Math.round(totalValoare * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    let totalFactura = Math.round((totalValoare + totalTva) * 100) / 100;

    // Aliniem cu totalul facturii doar pentru diferențe de rotunjire (recepție parțială / prețuri modificate = se păstrează suma liniilor)
    if (archiveTotal && !isNaN(archiveTotal) && Math.abs(Math.abs(archiveTotal) - Math.abs(totalFactura)) <= 0.15) {
      totalFactura = archiveTotal;
      if (archiveTotalVat !== null && !isNaN(archiveTotalVat)) {
        totalTva = totalFactura < 0 ? -Math.abs(archiveTotalVat) : Math.abs(archiveTotalVat);
        totalValoare = Math.round((totalFactura - totalTva) * 100) / 100;
      }
    }

    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    // Furnizorul (de la cine s-a recepționat)
    const supplierCountry = detectCountryFromCui(n.supplierCUI);
    xml += `      <FurnizorNume>${escapeXml(n.supplierName || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.supplierCUI || "")}</FurnizorCIF>\n`;
    xml += `      <FurnizorTara>${escapeXml(supplierCountry)}</FurnizorTara>\n`;

    // Clientul suntem NOI (astfel SAGA C știe că este achiziție / intrare de marfă)
    xml += `      <ClientNume>${escapeXml(company.name)}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(company.cui)}</ClientCIF>\n`;
    if (company.regCom) xml += `      <ClientNrRegCom>${escapeXml(company.regCom)}</ClientNrRegCom>\n`;
    if (company.county) xml += `      <ClientJudet>${escapeXml(company.county)}</ClientJudet>\n`;
    xml += `      <ClientTara>${escapeXml(company.country || "RO")}</ClientTara>\n`;
    if (company.city) xml += `      <ClientLocalitate>${escapeXml(company.city)}</ClientLocalitate>\n`;
    if (company.address) xml += `      <ClientAdresa>${escapeXml(company.address)}</ClientAdresa>\n`;

    // Date document (folosim data facturii, nu data importului)
    xml += `      <FacturaNumar>${escapeXml(n.invoiceNumber || n.nirNumber)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(docDate)}</FacturaData>\n`;
    if (dueDate) {
      xml += `      <FacturaScadenta>${formatDate(dueDate)}</FacturaScadenta>\n`;
    }
    xml += `      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>\n`;
    xml += `      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>\n`;
    xml += `      <FacturaTip></FacturaTip>\n`;
    xml += `      <FacturaMoneda>${escapeXml(currency || "RON")}</FacturaMoneda>\n`;
    if (currency && currency !== "RON" && currency !== "LEI" && exchangeRate && exchangeRate > 0) {
      xml += `      <FacturaCurs>${exchangeRate.toFixed(4)}</FacturaCurs>\n`;
    }
    xml += `      <FacturaTotalValoare>${totalValoare.toFixed(2)}</FacturaTotalValoare>\n`;
    xml += `      <FacturaTotalTVA>${totalTva.toFixed(2)}</FacturaTotalTVA>\n`;
    xml += `      <FacturaTotal>${totalFactura.toFixed(2)}</FacturaTotal>\n`;
    if (spvIndex) {
      xml += formatSpvTags(spvIndex);
    }
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;

    let lineIndex = 1;
    for (const item of processedLines) {
      const lineTip = resolveSagaLineTip((item.line as any).accountingType, item.lineAcc, n.accountingType);
      let lineAcc = item.lineAcc;
      if (lineTip === "Materii prime" && (!lineAcc || lineAcc.startsWith("371") || lineAcc.startsWith("302"))) {
        lineAcc = "301";
      } else if (lineTip === "Marfuri" && (!lineAcc || lineAcc.startsWith("301") || lineAcc.startsWith("302"))) {
        lineAcc = "371";
      } else if (lineTip === "Obiecte de inventar" && (!lineAcc || !lineAcc.startsWith("303"))) {
        lineAcc = "303";
      } else if ((lineTip === "Materiale consumabile" || lineTip === "Alte mat. consumabile") && (!lineAcc || !lineAcc.startsWith("302"))) {
        lineAcc = "3028";
      }
      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${lineIndex++}</LinieNrCrt>\n`;
      if (n.gestiune && !item.isServiceOrAdvance) {
        xml += `          <Gestiune>${escapeXml(n.gestiune)}</Gestiune>\n`;
      }
      xml += `          <Tip>${escapeXml(lineTip)}</Tip>\n`;
      xml += `          <Descriere>${escapeXml(item.line.description)}</Descriere>\n`;
      if (item.code && !item.isServiceOrAdvance) {
        xml += `          <Cod>${escapeXml(item.code)}</Cod>\n`;
        xml += `          <CodArticol>${escapeXml(item.code)}</CodArticol>\n`;
        xml += `          <CodArticolFurnizor>${escapeXml(item.code)}</CodArticolFurnizor>\n`;
      }
      xml += `          <UM>${escapeXml(normalizeSagaUm(item.line.unit))}</UM>\n`;
      xml += `          <Cantitate>${item.qty}</Cantitate>\n`;
      xml += `          <Pret>${item.price.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${item.lineVal.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${item.rate}</ProcTVA>\n`;
      xml += `          <TVA>${item.lineVat.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>${escapeXml(lineAcc)}</Cont>\n`;
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
    xml += `    <TVA>${art.vatRate || "21"}</TVA>\n`;
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

  // 1. Identificăm partenerii cărora li s-au emis facturi (inclusiv furnizori cărora li s-au facturat servicii/mărfuri)
  const billedInvoices = await db
    .select({ clientId: schema.emittedInvoices.clientId })
    .from(schema.emittedInvoices)
    .where(eq(schema.emittedInvoices.tenantId, tenantId));
  const billedSet = new Set(billedInvoices.map((b) => b.clientId).filter(Boolean));

  // 2. Selectăm strict clienții (isSupplier = 0 / falsy) sau partenerii facturați explicit ca clienți
  const relevantClients = clientsList.filter((c) => !c.isSupplier || billedSet.has(c.id));

  // 3. Deduplicare pe CUI valid și garantare unicitate <Cod> în SAGA C
  const uniqueClients: (typeof clientsList[0] & { finalCode: string })[] = [];
  const seenCuis = new Map<string, typeof clientsList[0]>();
  const seenCodes = new Set<string>();

  for (const client of relevantClients) {
    const rawCui = (client.cui || "").replace(/^RO/i, "").trim().toUpperCase();
    const isGenericCui = !rawCui || rawCui === "0000000000000" || rawCui === "PF" || rawCui === "-";

    if (!isGenericCui) {
      if (seenCuis.has(rawCui)) {
        continue;
      }
      seenCuis.set(rawCui, client);
    }

    let cod = client.sagaCode && client.sagaCode !== "null" ? client.sagaCode.trim() : String(client.id);
    if (seenCodes.has(cod)) {
      cod = String(client.id);
    }
    seenCodes.add(cod);

    uniqueClients.push({
      ...client,
      finalCode: cod,
    });
  }

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n`;
  xml += `<Clienti>\n`;

  for (const client of uniqueClients) {
    xml += `  <Linie>\n`;
    xml += `    <Cod>${escapeXml(client.finalCode)}</Cod>\n`;
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

export interface SimulatedSagaWarning {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface SimulatedSagaLine {
  nrCrt: number;
  tip: string;
  gestiune: string;
  denumire: string;
  cod: string;
  codeOrigin: "saga_000" | "app_088" | "custom" | "service_none";
  matchType: "exact" | "words_and_price" | "new_088" | "new_custom" | "none";
  matchedWords?: string[];
  matchedPrice?: number | null;
  sagaArticleName?: string | null;
  um: string;
  tvaPercent: number;
  cantitate: number;
  pretUnitar: number;
  valoare: number;
  total: number;
  tvaSuma: number;
  cont: string;
  warnings: SimulatedSagaWarning[];
}

export interface SimulatedSagaDocument {
  docIndex: number;
  nirId: number | null;
  nirNumber: string;
  nrInternSaga: string;
  nrDoc: string;
  furnizorCodSaga: string;
  furnizorNume: string;
  furnizorCui: string;
  isNewSupplier: boolean;
  tvaIncasare: boolean;
  dataDoc: string;
  dataScadenta: string;
  moneda: string;
  curs: number;
  valoare: number;
  tva: number;
  total: number;
  spvIndex: string;
  archiveTotal: number | null;
  gestiuneHeader: string;
  warnings: SimulatedSagaWarning[];
  lines: SimulatedSagaLine[];
}

export interface DraftNirSimulationInput {
  id?: number;
  invoiceArchiveId?: number;
  nirNumber?: string;
  receiptDate: string;
  invoiceNumber?: string;
  avizNumber?: string;
  gestiune?: string;
  supplierName: string;
  supplierCUI?: string;
  supplierAddress?: string;
  accountingType?: string;
  accountingAccount?: string;
  currency?: string;
  exchangeRate?: string;
  spvIndex?: string;
  lines: Array<{
    description: string;
    unit?: string;
    cantitateReceptionata: string | number;
    unitPrice?: string | number;
    vatRate?: string | number;
    total?: string | number;
    accountingType?: string;
    accountingAccount?: string;
    sagaArticleId?: number;
    articleCode?: string;
  }>;
}

export async function simulateSagaNirImport(
  tenantId: number,
  options?: {
    nirId?: number;
    nirIds?: number[];
    month?: number;
    year?: number;
    draftNir?: DraftNirSimulationInput;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("No DB");

  const company = await getTenantCompanyProfile(tenantId);
  const { sagaArticles, sagaFurnizori, sagaIntrari, sagaGestiuni } = await import("../modules/saga/schema");

  // Load suppliers from sagaFurnizori for CUI/Name lookup
  const furnizoriList = await db
    .select()
    .from(sagaFurnizori)
    .where(eq(sagaFurnizori.tenantId, tenantId));

  const normCui = (c?: string | null) => String(c || "").replace(/^RO/i, "").replace(/\D/g, "").trim();
  const normName = (s?: string | null) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const furnByCui = new Map<string, any>();
  const furnByName = new Map<string, any>();
  for (const f of furnizoriList) {
    const c = normCui(f.cui || (f as any).codFiscal);
    if (c) furnByCui.set(c, f);
    const n = normName(f.denumire);
    if (n) furnByName.set(n, f);
  }

  // Load existing sagaIntrari & all NIRs for duplicate detection
  const allSagaIntrari = await db
    .select()
    .from(sagaIntrari)
    .where(eq(sagaIntrari.tenantId, tenantId));

  const allNirs = await db
    .select()
    .from(schema.nir)
    .where(eq(schema.nir.tenantId, tenantId));

  const gestiuniList = await db
    .select()
    .from(sagaGestiuni)
    .where(eq(sagaGestiuni.tenantId, tenantId));
  const gestiuniNames = new Set(gestiuniList.map((g: any) => String(g.denumire || "").trim().toUpperCase()).filter(Boolean));

  const articleState = await loadEnrichedSagaArticles(db, tenantId);

  // Build list of target NIR records to simulate
  type TargetNirItem = {
    isDraft: boolean;
    header: any;
    rawLines: Array<{
      id?: number;
      description: string;
      unit?: string | null;
      cantitateReceptionata: string | number | null;
      unitPrice?: string | number | null;
      vatRate?: string | number | null;
      total?: string | number | null;
      accountingType?: string | null;
      accountingAccount?: string | null;
      sagaArticleId?: number | null;
      articleCode?: string | null;
    }>;
  };

  const targets: TargetNirItem[] = [];

  if (options?.draftNir) {
    const d = options.draftNir;
    targets.push({
      isDraft: !d.id,
      header: {
        id: d.id || null,
        tenantId,
        invoiceArchiveId: d.invoiceArchiveId || null,
        nirNumber: d.nirNumber || "NIR-DRAFT",
        receiptDate: d.receiptDate,
        invoiceNumber: d.invoiceNumber || "",
        avizNumber: d.avizNumber || "",
        gestiune: d.gestiune || "",
        supplierName: d.supplierName || "",
        supplierCUI: d.supplierCUI || "",
        supplierAddress: d.supplierAddress || "",
        accountingType: d.accountingType || "Marfa",
        accountingAccount: d.accountingAccount || "371",
        currency: d.currency || "RON",
        exchangeRate: d.exchangeRate || "1",
        spvIndex: d.spvIndex || "",
      },
      rawLines: d.lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        cantitateReceptionata: l.cantitateReceptionata,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        total: l.total,
        accountingType: l.accountingType || d.accountingType,
        accountingAccount: l.accountingAccount || d.accountingAccount,
        sagaArticleId: l.sagaArticleId,
        articleCode: l.articleCode,
      })),
    });
  } else {
    let selectedNirs = [...allNirs];
    const targetIds =
      options?.nirIds && options.nirIds.length > 0 ? options.nirIds : options?.nirId;

    if (targetIds) {
      if (Array.isArray(targetIds)) {
        const idSet = new Set(targetIds);
        selectedNirs = selectedNirs.filter((n) => idSet.has(n.id));
      } else {
        selectedNirs = selectedNirs.filter((n) => n.id === targetIds);
      }
    } else if (options?.month !== undefined && options?.year !== undefined) {
      const isAllYear = !options.month || options.month === 0;
      const startDateStr = isAllYear
        ? `${options.year}-01-01`
        : `${options.year}-${String(options.month).padStart(2, "0")}-01`;
      const lastDay = isAllYear ? 31 : new Date(options.year, options.month, 0).getDate();
      const endDateStr = isAllYear
        ? `${options.year}-12-31`
        : `${options.year}-${String(options.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      selectedNirs = selectedNirs.filter((n) => {
        if (!n.receiptDate) return false;
        const nDate = n.receiptDate.substring(0, 10);
        return nDate >= startDateStr && nDate <= endDateStr;
      });
    }

    for (const n of selectedNirs) {
      const linesData = await db
        .select({
          line: schema.nirLines,
          articleCode: sagaArticles.code,
        })
        .from(schema.nirLines)
        .leftJoin(
          sagaArticles,
          and(eq(schema.nirLines.sagaArticleId, sagaArticles.id), eq(sagaArticles.tenantId, tenantId))
        )
        .where(eq(schema.nirLines.nirId, n.id));

      targets.push({
        isDraft: false,
        header: n,
        rawLines: linesData.map((r) => ({
          id: r.line.id,
          description: r.line.description,
          unit: r.line.unit,
          cantitateReceptionata: r.line.cantitateReceptionata,
          unitPrice: r.line.unitPrice,
          vatRate: r.line.vatRate,
          total: r.line.total,
          accountingType: r.line.accountingType,
          accountingAccount: r.line.accountingAccount,
          sagaArticleId: r.line.sagaArticleId,
          articleCode: r.articleCode,
        })),
      });
    }
  }

  let xml = `<?xml version="1.0" encoding="Windows-1250"?>\n<Facturi>\n`;
  const documents: SimulatedSagaDocument[] = [];
  const seenBatchKeys = new Set<string>();

  let totalSaga000Count = 0;
  let totalWordsPriceMatchedCount = 0;
  let totalNew088Count = 0;
  let totalWarningsCount = 0;
  let totalErrorsCount = 0;

  let docIndex = 1;
  for (const item of targets) {
    const n = item.header;
    const spvResolved = await resolveNirSpvData(db, n);
    const spvIndex = n.spvIndex || spvResolved.spvIndex || "";
    const docDate = spvResolved.docDate || n.receiptDate;
    const dueDate = spvResolved.dueDate || docDate;
    const archiveTotal = spvResolved.archiveTotal;
    const archiveTotalVat = spvResolved.archiveTotalVat;
    const currency = (n.currency || spvResolved.currency || "RON").toUpperCase();
    const exchangeRate = parseFloat(String(n.exchangeRate || spvResolved.exchangeRate || "1")) || 1;

    const docWarnings: SimulatedSagaWarning[] = [];

    // 1. Lookup supplier in sagaFurnizori
    const supplierCuiDigits = normCui(n.supplierCUI);
    const supplierNameNorm = normName(n.supplierName);
    const matchedFurnizor =
      (supplierCuiDigits && furnByCui.get(supplierCuiDigits)) ||
      (supplierNameNorm && furnByName.get(supplierNameNorm)) ||
      null;

    const furnizorCodSaga = matchedFurnizor?.cod || "NOU";
    const isNewSupplier = !matchedFurnizor;

    if (isNewSupplier) {
      docWarnings.push({
        level: "info",
        code: "NEW_SUPPLIER",
        message: `Furnizorul "${n.supplierName}" (${n.supplierCUI || "fără CUI"}) nu există încă în nomenclatorul SAGA importat — SAGA C îl va crea automat la import.`,
      });
    }

    const rawDocNum = String(n.invoiceNumber || n.nirNumber || "").trim();
    const cleanDocNum = rawDocNum.toUpperCase();

    if (!n.invoiceNumber || rawDocNum.toUpperCase().startsWith("NIR-")) {
      docWarnings.push({
        level: "warning",
        code: "MISSING_INVOICE_NUM",
        message: `Numărul facturii furnizorului nu este completat. În SAGA C va apărea "${rawDocNum}" la Nr. doc.`,
      });
    }

    // 2. Duplicate check in batch
    const batchKey = `${supplierCuiDigits}_${cleanDocNum}`;
    if (cleanDocNum && seenBatchKeys.has(batchKey)) {
      docWarnings.push({
        level: "error",
        code: "DUPLICATE_IN_BATCH",
        message: `Factura "${rawDocNum}" de la acest furnizor apare de două ori în pachetul selectat pentru export!`,
      });
    }
    if (cleanDocNum) seenBatchKeys.add(batchKey);

    // 3. Duplicate check in sagaIntrari (imported from SAGA C)
    if (cleanDocNum) {
      const dupSaga = allSagaIntrari.find((si: any) => {
        if (n.id && si.nirId === n.id) return false;
        const siDoc = String(si.nrDoc || "").trim().toUpperCase();
        if (siDoc !== cleanDocNum) return false;
        const siCui = normCui(si.cuiFurnizor);
        if (supplierCuiDigits && siCui) return supplierCuiDigits === siCui;
        return normName(si.numeFurnizor) === supplierNameNorm;
      });
      if (dupSaga) {
        docWarnings.push({
          level: "warning",
          code: "ALREADY_IN_SAGA",
          message: `Atenție: Factura "${rawDocNum}" apare deja în Intrări SAGA (Nr. int. ${dupSaga.nrIntern || "-"}, data ${dupSaga.data || "-"}). Verifică să nu fie importată dublu!`,
        });
      }

      // Duplicate check in other NIRs
      const dupNir = allNirs.find((other: any) => {
        if (n.id && other.id === n.id) return false;
        const otherDoc = String(other.invoiceNumber || "").trim().toUpperCase();
        if (!otherDoc || otherDoc !== cleanDocNum) return false;
        const otherCui = normCui(other.supplierCUI);
        if (supplierCuiDigits && otherCui) return supplierCuiDigits === otherCui;
        return normName(other.supplierName) === supplierNameNorm;
      });
      if (dupNir) {
        docWarnings.push({
          level: "warning",
          code: "DUPLICATE_NIR",
          message: `Mai există un alt NIR (${dupNir.nirNumber}) creat în aplicație pentru aceeași factură (${rawDocNum}).`,
        });
      }
    }

    // Check Gestiune
    const gestiuneStr = String(n.gestiune || "").trim();
    if (gestiuneStr && gestiuniNames.size > 0 && !gestiuniNames.has(gestiuneStr.toUpperCase())) {
      docWarnings.push({
        level: "info",
        code: "GESTIUNE_NOT_IN_SAGA_LIST",
        message: `Gestiunea "${gestiuneStr}" nu a fost găsită în lista gestiunilor sincronizate din SAGA (${Array.from(gestiuniNames).join(", ")}).`,
      });
    }

    let totalValoare = 0;
    let totalTva = 0;
    const simulatedLines: SimulatedSagaLine[] = [];
    let missingGestiuneOnStockLines = false;

    let lineNr = 1;
    for (const rawLine of item.rawLines) {
      const lineWarnings: SimulatedSagaWarning[] = [];
      let lineAcc = String(rawLine.accountingAccount || n.accountingAccount || "371").trim();
      const lineTip = resolveSagaLineTip(rawLine.accountingType, lineAcc, n.accountingType);

      if (lineTip === "Materii prime" && (!lineAcc || lineAcc.startsWith("371") || lineAcc.startsWith("302"))) {
        lineAcc = "301";
      } else if (lineTip === "Marfuri" && (!lineAcc || lineAcc.startsWith("301") || lineAcc.startsWith("302"))) {
        lineAcc = "371";
      } else if (lineTip === "Obiecte de inventar" && (!lineAcc || !lineAcc.startsWith("303"))) {
        lineAcc = "303";
      } else if ((lineTip === "Materiale consumabile" || lineTip === "Alte mat. consumabile") && (!lineAcc || !lineAcc.startsWith("302"))) {
        lineAcc = "3028";
      }

      const isServiceOrAdvance =
        lineAcc.startsWith("6") ||
        lineAcc.startsWith("7") ||
        lineAcc.startsWith("409") ||
        lineTip === "Servicii";

      const resolvedArt = await resolveOrCreateArticleForLine(
        db,
        tenantId,
        {
          description: rawLine.description,
          unit: rawLine.unit,
          unitPrice: rawLine.unitPrice,
          vatRate: rawLine.vatRate,
          accountingType: rawLine.accountingType || n.accountingType,
          accountingAccount: lineAcc,
          sagaArticleId: rawLine.sagaArticleId,
          articleCode: rawLine.articleCode,
        },
        articleState,
        {
          persistToDb: !item.isDraft,
          nirLineId: rawLine.id,
        }
      );

      const code = isServiceOrAdvance ? "" : (resolvedArt.articleCode || "");
      let codeOrigin: SimulatedSagaLine["codeOrigin"] = "service_none";
      if (!isServiceOrAdvance) {
        if (isAppGeneratedArticleCode(code)) {
          codeOrigin = "app_088";
          totalNew088Count++;
        } else if (/^000\d+$/.test(code)) {
          codeOrigin = "saga_000";
          totalSaga000Count++;
        } else {
          codeOrigin = "custom";
        }
      }

      if (resolvedArt.matchType === "words_and_price") {
        totalWordsPriceMatchedCount++;
        lineWarnings.push({
          level: "info",
          code: "SMART_MATCH_WORDS_PRICE",
          message: `Asociat inteligent cu articolul SAGA "${resolvedArt.matchedArticle?.name}" (${code}) pe baza cuvintelor comune (${(resolvedArt.matchedWords || []).join(", ")}) și a prețului unitar identic.`,
        });
      }

      let qty = parseFloat(String(rawLine.cantitateReceptionata)) || 0;
      let price = parseFloat(String(rawLine.unitPrice)) || 0;
      const rate = parseFloat(String(rawLine.vatRate)) || 0;
      const rawTotal = parseFloat(String(rawLine.total));
      let lineVal = !isNaN(rawTotal) && rawTotal !== 0 ? rawTotal : Math.round(qty * price * 100) / 100;

      if (lineVal < 0) {
        if (qty > 0 && price > 0) qty = -qty;
        else if (qty > 0 && price === 0) {
          qty = -qty;
          price = Math.abs(lineVal);
        }
      } else if (lineVal > 0) {
        qty = Math.abs(qty);
        price = Math.abs(price);
      }

      let lineVat = Math.round(lineVal * (rate / 100) * 100) / 100;
      if (lineVal < 0 && lineVat > 0) lineVat = -lineVat;
      if (lineVal > 0 && lineVat < 0) lineVat = Math.abs(lineVat);
      const lineTotal = Math.round((lineVal + lineVat) * 100) / 100;

      totalValoare += lineVal;
      totalTva += lineVat;

      const calcVal = Math.round(qty * price * 100) / 100;
      if (Math.abs(calcVal - lineVal) > 0.05) {
        lineWarnings.push({
          level: "warning",
          code: "LINE_MATH_DIFF",
          message: `Cantitate (${qty}) × Preț (${price.toFixed(4)}) = ${calcVal.toFixed(2)}, dar Valoarea liniei este ${lineVal.toFixed(2)}.`,
        });
      }

      if (!isServiceOrAdvance && !gestiuneStr) {
        missingGestiuneOnStockLines = true;
      }

      const normUm = normalizeSagaUm(rawLine.unit).toUpperCase();

      simulatedLines.push({
        nrCrt: lineNr++,
        tip: lineTip,
        gestiune: isServiceOrAdvance ? "" : gestiuneStr,
        denumire: rawLine.description || "",
        cod: code,
        codeOrigin,
        matchType: resolvedArt.matchType,
        matchedWords: resolvedArt.matchedWords,
        matchedPrice: resolvedArt.matchedPrice,
        sagaArticleName: resolvedArt.matchedArticle?.name || null,
        um: normUm,
        tvaPercent: rate,
        cantitate: qty,
        pretUnitar: price,
        valoare: lineVal,
        total: lineTotal,
        tvaSuma: lineVat,
        cont: lineAcc,
        warnings: lineWarnings,
      });
    }

    if (missingGestiuneOnStockLines) {
      docWarnings.push({
        level: "warning",
        code: "MISSING_GESTIUNE",
        message: `Gestiunea destinatară nu este completată pe NIR. În SAGA C coloana "Gestiune" va fi goală și va trebui completată manual înainte de validare.`,
      });
    }

    totalValoare = Math.round(totalValoare * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    let totalFactura = Math.round((totalValoare + totalTva) * 100) / 100;

    if (archiveTotal && !isNaN(archiveTotal) && Math.abs(Math.abs(archiveTotal) - Math.abs(totalFactura)) <= 0.15) {
      totalFactura = archiveTotal;
      if (archiveTotalVat !== null && !isNaN(archiveTotalVat)) {
        totalTva = totalFactura < 0 ? -Math.abs(archiveTotalVat) : Math.abs(archiveTotalVat);
        totalValoare = Math.round((totalFactura - totalTva) * 100) / 100;
      }
    } else if (archiveTotal && !isNaN(archiveTotal) && Math.abs(archiveTotal - totalFactura) > 0.15) {
      docWarnings.push({
        level: "warning",
        code: "SPV_TOTAL_MISMATCH",
        message: `Totalul NIR (${totalFactura.toFixed(2)} ${currency}) diferă de totalul facturii originale din SPV (${archiveTotal.toFixed(2)} ${currency}) cu ${(totalFactura - archiveTotal).toFixed(2)} ${currency}.`,
      });
    }

    // Build XML block for this document so the simulator XML matches 100%
    const supplierCountry = detectCountryFromCui(n.supplierCUI);
    xml += `  <Factura>\n`;
    xml += `    <Antet>\n`;
    xml += `      <FurnizorNume>${escapeXml(n.supplierName || "")}</FurnizorNume>\n`;
    xml += `      <FurnizorCIF>${escapeXml(n.supplierCUI || "")}</FurnizorCIF>\n`;
    xml += `      <FurnizorTara>${escapeXml(supplierCountry)}</FurnizorTara>\n`;
    xml += `      <ClientNume>${escapeXml(company.name)}</ClientNume>\n`;
    xml += `      <ClientCIF>${escapeXml(company.cui)}</ClientCIF>\n`;
    if (company.regCom) xml += `      <ClientNrRegCom>${escapeXml(company.regCom)}</ClientNrRegCom>\n`;
    if (company.county) xml += `      <ClientJudet>${escapeXml(company.county)}</ClientJudet>\n`;
    xml += `      <ClientTara>${escapeXml(company.country || "RO")}</ClientTara>\n`;
    if (company.city) xml += `      <ClientLocalitate>${escapeXml(company.city)}</ClientLocalitate>\n`;
    if (company.address) xml += `      <ClientAdresa>${escapeXml(company.address)}</ClientAdresa>\n`;
    xml += `      <FacturaNumar>${escapeXml(n.invoiceNumber || n.nirNumber)}</FacturaNumar>\n`;
    xml += `      <FacturaData>${formatDate(docDate)}</FacturaData>\n`;
    if (dueDate) {
      xml += `      <FacturaScadenta>${formatDate(dueDate)}</FacturaScadenta>\n`;
    }
    xml += `      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>\n`;
    xml += `      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>\n`;
    xml += `      <FacturaTip></FacturaTip>\n`;
    xml += `      <FacturaMoneda>${escapeXml(currency || "RON")}</FacturaMoneda>\n`;
    if (currency && currency !== "RON" && currency !== "LEI" && exchangeRate && exchangeRate > 0) {
      xml += `      <FacturaCurs>${exchangeRate.toFixed(4)}</FacturaCurs>\n`;
    }
    xml += `      <FacturaTotalValoare>${totalValoare.toFixed(2)}</FacturaTotalValoare>\n`;
    xml += `      <FacturaTotalTVA>${totalTva.toFixed(2)}</FacturaTotalTVA>\n`;
    xml += `      <FacturaTotal>${totalFactura.toFixed(2)}</FacturaTotal>\n`;
    if (spvIndex) {
      xml += formatSpvTags(spvIndex);
    }
    xml += `    </Antet>\n`;
    xml += `    <Detalii>\n`;
    xml += `      <Continut>\n`;
    for (const sl of simulatedLines) {
      xml += `        <Linie>\n`;
      xml += `          <LinieNrCrt>${sl.nrCrt}</LinieNrCrt>\n`;
      if (sl.gestiune) {
        xml += `          <Gestiune>${escapeXml(sl.gestiune)}</Gestiune>\n`;
      }
      xml += `          <Tip>${escapeXml(sl.tip)}</Tip>\n`;
      xml += `          <Descriere>${escapeXml(sl.denumire)}</Descriere>\n`;
      if (sl.cod) {
        xml += `          <Cod>${escapeXml(sl.cod)}</Cod>\n`;
        xml += `          <CodArticol>${escapeXml(sl.cod)}</CodArticol>\n`;
        xml += `          <CodArticolFurnizor>${escapeXml(sl.cod)}</CodArticolFurnizor>\n`;
      }
      xml += `          <UM>${escapeXml(sl.um.toLowerCase())}</UM>\n`;
      xml += `          <Cantitate>${sl.cantitate}</Cantitate>\n`;
      xml += `          <Pret>${sl.pretUnitar.toFixed(4)}</Pret>\n`;
      xml += `          <Valoare>${sl.valoare.toFixed(2)}</Valoare>\n`;
      xml += `          <ProcTVA>${sl.tvaPercent}</ProcTVA>\n`;
      xml += `          <TVA>${sl.tvaSuma.toFixed(2)}</TVA>\n`;
      xml += `          <Cont>${escapeXml(sl.cont)}</Cont>\n`;
      xml += `        </Linie>\n`;
    }
    xml += `      </Continut>\n`;
    xml += `    </Detalii>\n`;
    xml += `  </Factura>\n`;

    for (const w of docWarnings) {
      if (w.level === "error") totalErrorsCount++;
      else if (w.level === "warning") totalWarningsCount++;
    }
    for (const sl of simulatedLines) {
      for (const w of sl.warnings) {
        if (w.level === "error") totalErrorsCount++;
        else if (w.level === "warning") totalWarningsCount++;
      }
    }

    const dateCompact = String(docDate || "").replace(/\D/g, "").slice(-6) || "261001";
    const nrInternSim = `${dateCompact}${String(docIndex).padStart(2, "0")}`;

    documents.push({
      docIndex: docIndex++,
      nirId: n.id || null,
      nirNumber: n.nirNumber || "NIR",
      nrInternSaga: nrInternSim,
      nrDoc: rawDocNum,
      furnizorCodSaga,
      furnizorNume: n.supplierName || "",
      furnizorCui: n.supplierCUI || "",
      isNewSupplier,
      tvaIncasare: false,
      dataDoc: formatDate(docDate),
      dataScadenta: formatDate(dueDate),
      moneda: currency,
      curs: exchangeRate,
      valoare: totalValoare,
      tva: totalTva,
      total: totalFactura,
      spvIndex,
      archiveTotal,
      gestiuneHeader: gestiuneStr,
      warnings: docWarnings,
      lines: simulatedLines,
    });
  }

  xml += `</Facturi>\n`;

  const safeCui = company.cui.replace(/^RO/i, "").trim() || "EXPORT";
  let filename = `F_${safeCui}_NIR_ALL.xml`;
  if (documents.length === 1) {
    const single = documents[0];
    const docPart = (single.nirNumber || single.nrDoc || "NIR").replace(/[^a-zA-Z0-9_-]/g, "_");
    filename = `F_${safeCui}_${docPart}.xml`;
  } else if (options?.nirIds && options.nirIds.length > 0) {
    filename = `F_${safeCui}_NIR_SEL_${options.nirIds.length}.xml`;
  } else if (options?.month && options?.year) {
    filename =
      options.month === 0
        ? `F_${safeCui}_NIR_ALL_${options.year}.xml`
        : `F_${safeCui}_NIR_${options.month}_${options.year}.xml`;
  }

  return {
    companyName: company.name,
    companyCui: company.cui,
    filename,
    xml,
    documents,
    summary: {
      totalDocuments: documents.length,
      totalLines: documents.reduce((s, d) => s + d.lines.length, 0),
      totalSaga000Count,
      totalWordsPriceMatchedCount,
      totalNew088Count,
      totalWarningsCount,
      totalErrorsCount,
    },
  };
}

