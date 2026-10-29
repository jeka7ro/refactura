/**
 * Shared Article Matching & `088xxxxx` Code Generator
 *
 * 1. Coduri articole:
 *    - Articolele importate din SAGA C păstrează formatul lor `000xxxxx` (ex: `00010208`).
 *    - Articolele noi create automat de aplicație primesc coduri `088xxxxx` (ex: `08800001`),
 *      evitând orice suprapunere sau dublare cu contorul intern din SAGA C.
 *
 * 2. Asocierea articolelor de pe facturi:
 *    - Nivel 1 ("exact"): denumirea normalizată coincide 100% (sau prefix lung fără conflict de variantă).
 *    - Nivel 2 ("words_and_price"): cel puțin 2 cuvinte semnificative comune + același preț unitar,
 *      cu filtru de siguranță pentru variante opuse (ex: STG vs DR, ALB vs MARO vs ANTRACIT).
 */

export const APP_ARTICLE_PREFIX = "088";

export function formatAppArticleCode(seq: number): string {
  const safeSeq = Math.max(1, Math.floor(seq));
  return `${APP_ARTICLE_PREFIX}${String(safeSeq).padStart(5, "0")}`;
}

export function isAppGeneratedArticleCode(code?: string | null): boolean {
  return /^088\d{5}$/.test((code || "").trim());
}

export function isSagaNativeArticleCode(code?: string | null): boolean {
  const c = (code || "").trim();
  return /^00\d{5,6}$/.test(c);
}

export function computeNext088Seq(
  existingCodes: Array<string | null | undefined>
): number {
  let maxSeq = 0;
  for (const raw of existingCodes) {
    const c = (raw || "").trim();
    const m = c.match(/^088(\d{5})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  return maxSeq + 1;
}

export function normalizeArticleText(text?: string | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "de",
  "cu",
  "la",
  "in",
  "pt",
  "pentru",
  "si",
  "din",
  "pe",
  "un",
  "o",
  "al",
  "ale",
  "ai",
  "cel",
  "cea",
  "buc",
  "bucata",
  "bucati",
  "set",
  "art",
  "cod",
]);

export function tokenizeArticleName(text?: string | null): string[] {
  const norm = normalizeArticleText(text);
  if (!norm) return [];
  const rawTokens = norm
    .split(" ")
    .map(t => t.replace(/^[.\/-]+|[.\/-]+$/g, ""))
    .filter(Boolean);

  const result: string[] = [];
  const seen = new Set<string>();
  for (const tok of rawTokens) {
    if (tok.length < 2) continue;
    if (STOP_WORDS.has(tok)) continue;
    if (!seen.has(tok)) {
      seen.add(tok);
      result.push(tok);
    }
  }
  return result;
}

const LEFT_TOKENS = new Set(["stg", "stanga", "left"]);
const RIGHT_TOKENS = new Set(["dr", "dreapta", "right"]);

const COLOR_GROUPS: string[][] = [
  ["alb", "white"],
  ["maro", "brown", "ciocolatiu"],
  ["negru", "black"],
  ["antracit"],
  ["gri", "grey", "gray"],
  ["auriu", "gold"],
  ["argintiu", "silver", "inox"],
  ["stejar", "wenge", "mahon", "nuc"],
];

function extractRawWordSet(text?: string | null): Set<string> {
  const norm = normalizeArticleText(text);
  if (!norm) return new Set();
  const words = norm
    .replace(/[./-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return new Set(words);
}

/**
 * Verifică dacă două denumiri conțin indicatori de variantă opuși
 * (ex: STG vs DR, sau ALB vs MARO).
 */
export function hasVariantConflict(textA?: string | null, textB?: string | null): boolean {
  const setA = extractRawWordSet(textA);
  const setB = extractRawWordSet(textB);

  const aLeft = Array.from(LEFT_TOKENS).some(t => setA.has(t));
  const aRight = Array.from(RIGHT_TOKENS).some(t => setA.has(t));
  const bLeft = Array.from(LEFT_TOKENS).some(t => setB.has(t));
  const bRight = Array.from(RIGHT_TOKENS).some(t => setB.has(t));

  if ((aLeft && bRight && !aRight && !bLeft) || (aRight && bLeft && !aLeft && !bRight)) {
    return true;
  }

  let colorIdxA = -1;
  let colorIdxB = -1;
  COLOR_GROUPS.forEach((grp, idx) => {
    if (grp.some(c => setA.has(c))) colorIdxA = idx;
    if (grp.some(c => setB.has(c))) colorIdxB = idx;
  });

  if (colorIdxA !== -1 && colorIdxB !== -1 && colorIdxA !== colorIdxB) {
    return true;
  }

  return false;
}

export function pricesMatch(
  linePrice: number,
  candidatePrices?: Array<number | string | null | undefined>
): boolean {
  const p1 = Math.abs(Number(linePrice) || 0);
  if (!(p1 > 0) || !candidatePrices || candidatePrices.length === 0) return false;

  const tol = Math.max(0.015, p1 * 0.005); // ±0.015 RON sau ±0.5% pentru 4 zecimale
  for (const raw of candidatePrices) {
    const p2 = Math.abs(Number(raw) || 0);
    if (p2 > 0 && Math.abs(p1 - p2) <= tol) {
      return true;
    }
  }
  return false;
}

export interface MatchableArticle {
  id?: number;
  code?: string | null;
  name?: string | null;
  unit?: string | null;
  vatRate?: string | number | null;
  category?: string | null;
  accountingAccount?: string | null;
  lastPrice?: number | string | null;
  knownPrices?: Array<number | string>;
}

export interface CandidateArticle extends MatchableArticle {
  id: number;
  code: string;
  name: string;
  knownPrices: number[];
  lastPrice: number | null;
}

export interface ArticleMatchResult<T extends MatchableArticle = MatchableArticle> {
  article: T;
  matchType: "exact" | "words_and_price";
  sharedWordsCount: number;
  sharedWords: string[];
  matchedWords?: string[];
  matchedPrice?: number | null;
}

export function findBestArticleMatch<T extends MatchableArticle>(
  description: string,
  unitPrice: number | string | null | undefined,
  articles: T[]
): ArticleMatchResult<T> | null {
  const descNorm = normalizeArticleText(description);
  if (!descNorm || !articles || articles.length === 0) return null;

  const priceNum = Math.abs(parseFloat(String(unitPrice ?? "0")) || 0);

  // 1. Potrivire exactă (100% denumire normalizată)
  for (const art of articles) {
    const aNorm = normalizeArticleText(art.name);
    if (!aNorm) continue;
    if (aNorm === descNorm) {
      const words = tokenizeArticleName(description);
      return {
        article: art,
        matchType: "exact",
        sharedWordsCount: words.length,
        sharedWords: words,
        matchedWords: words,
        matchedPrice: priceNum > 0 ? priceNum : null,
      };
    }
  }

  // 2. Potrivire după >= 2 cuvinte semnificative comune + același preț unitar
  const descTokens = tokenizeArticleName(description);
  if (descTokens.length >= 2 && priceNum > 0) {
    const descTokenSet = new Set(descTokens);
    let bestCandidate: ArticleMatchResult<T> | null = null;
    let bestScore = 0;

    for (const art of articles) {
      if (!art.name) continue;
      if (hasVariantConflict(description, art.name)) continue;

      const candidatePrices: Array<number | string | null | undefined> = [];
      if (art.knownPrices && Array.isArray(art.knownPrices)) {
        candidatePrices.push(...art.knownPrices);
      }
      if (art.lastPrice !== undefined && art.lastPrice !== null) {
        candidatePrices.push(art.lastPrice);
      }

      if (!pricesMatch(priceNum, candidatePrices)) continue;

      const artTokens = tokenizeArticleName(art.name);
      if (artTokens.length < 2) continue;

      const shared = artTokens.filter(t => descTokenSet.has(t));
      if (shared.length < 2) continue;

      // Scor: număr de cuvinte comune + proporția acoperită
      const coverage =
        shared.length / Math.max(descTokens.length, artTokens.length);
      const score = shared.length * 10 + coverage * 5;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = {
          article: art,
          matchType: "words_and_price",
          sharedWordsCount: shared.length,
          sharedWords: shared,
          matchedWords: shared,
          matchedPrice: priceNum,
        };
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }
  }

  return null;
}
