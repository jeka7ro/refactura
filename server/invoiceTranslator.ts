/**
 * Server-side automatic translator for Romanian invoice product and service lines
 * Specifically designed for external / foreign invoices (export invoices, intra-community, etc.)
 */

// In-memory cache to guarantee instantaneous translations without duplicate lookups
const translationCache = new Map<string, string>();

// 1. High-precision commercial terms dictionary
const COMMERCIAL_DICTIONARY: Record<string, string> = {
  // Wood, joinery & windows (RoWood specific & general)
  "TAMPLARIE LEMN STRATIFICAT": "Laminated wood joinery",
  "TAMPLARIE LEMN STATIFICAT": "Laminated wood joinery",
  "TAMPLARIE LEMN STRATIFICAT MERANTI 92 MM": "Laminated Meranti wood joinery, 92 mm",
  "TAMPLARIE LEMN STRATIFICAT MERANTI 68 MM": "Laminated Meranti wood joinery, 68 mm",
  "TAMPLARIE LEMN STRATIFICAT STEJAR 68 MM": "Laminated oak wood joinery, 68 mm",
  "TAMPLARIE LEMN STRATIFICAT PIN 68 MM": "Laminated pine wood joinery, 68 mm",
  "TAMPLARIE ALUMINIU": "Aluminium joinery",
  "TAMLPARIE ALUMINIU": "Aluminium joinery",
  "FEREASTRA LEMN": "Wood window",
  "FERESTRE LEMN": "Wood windows",
  "FEREASTRA DIN LEMN": "Wooden window",
  "FERESTRE DIN LEMN": "Wooden windows",
  "FEREASTRA ALUMINIU": "Aluminium window",
  "FERESTRE ALUMINIU": "Aluminium windows",
  "FERESTRE PVC": "PVC windows",
  "USA DIN LEMN": "Wooden door",
  "USI DIN LEMN": "Wooden doors",
  "USA LEMN": "Wooden door",
  "USA LEMN INTRARE": "Wooden entrance door",
  "USA GLISANTA ALUMINIU": "Aluminium sliding door",
  "USA DIN LEMN STRATIFICAT": "Laminated wood door",
  "USA DIN LEMN STRATIFICAT CU ACCESORII": "Laminated wood door with accessories",
  "STICLA TERMOIZOLANTA": "Insulating glass",
  "PRISMA LEMN VOPSITA": "Painted wood prism",
  "PRECADRE LEMN": "Wooden sub-frames",
  "GLAF LEMN": "Wooden windowsill",
  "OBLOANE": "Shutters",
  "RULOU DIN ALUMINIU": "Aluminium roller shutter",
  "RULOURI ALUMINIU": "Aluminium roller shutters",
  "GRILA DE VENTILATIE": "Ventilation grille",
  "ACCESORII FERONERIE": "Hardware accessories",
  "ACCESORII TAMPLARIE LEMN": "Wood joinery accessories",
  "MANER USA": "Door handle",
  "MANERE USI": "Door handles",
  "SILICON": "Silicone sealant",

  // Services & common invoice descriptions
  "PRESTARI SERVICII": "Provision of services",
  "SERVICII PRESTATE": "Services rendered",
  "SERVICII TRANSPORT": "Transportation services",
  "TRANSPORT MARFA": "Freight transportation",
  "TRANSPORT": "Transportation",
  "SERVICII MONTAJ": "Installation services",
  "MONTAJ": "Installation",
  "MANOPERA": "Labor / Workmanship",
  "SERVICII CONSULTANTA": "Consulting services",
  "CONSULTANTA": "Consultancy",
  "SERVICII IT": "IT services",
  "SERVICII MARKETING": "Marketing services",
  "CHIRIE": "Rent",
  "CAZARE": "Accommodation",
  "DEZVOLTARE SOFTWARE": "Software development",
  "MENTENANTA": "Maintenance",
  "REPARATII": "Repairs / Repair services",
};

// Populate the cache with known terms
for (const [ro, en] of Object.entries(COMMERCIAL_DICTIONARY)) {
  translationCache.set(ro.toUpperCase(), en);
}

/**
 * Applies pattern-based rules for Romanian invoices (advances, contracts, addendums, stages).
 */
function applyPatternRules(rawText: string): string | null {
  const clean = rawText.trim();
  const upper = clean.toUpperCase();

  // 1. Advance according to Addendum:
  // e.g. "AVANS CONFORM ACT ADITIONAL NR. 21/07.08.2026"
  // e.g. "AVANS II CONFORM ACT ADITIONAL NR. 21/07.08.2026"
  // e.g. "AVANS 50% CF ACT ADITIONAL NR. 6/10.02.2022"
  const actMatch = clean.match(
    /^AVANS\s*(?:([0-9IVXLCDM]+%?|[0-9IVXLCDM]+|\d+%?)\s*)?(?:CONFORM|CONF\.?|CF\.?)\s*(?:ACT\s*ADITIONAL|ACT\s*ADIT\.?|ACT\s*ADITIONALNR\.?|ACT\s*AD\.?)\s*(?:NR\.?)?\s*([0-9\/\.\-\s\w]+)$/i
  );
  if (actMatch) {
    const pct = actMatch[1] ? `${actMatch[1]} ` : "";
    const ref = actMatch[2].trim().replace(/\s+/g, " ");
    return `Advance payment ${pct}according to Addendum No. ${ref}`;
  }

  // 2. Advance according to Contract:
  // e.g. "AVANS CONFORM CONTRACT NR. 382/21.07.2026"
  // e.g. "AVANS II CONFORM CONTRACT NR. 382/21.07.2026"
  // e.g. "AVANS 50% CONF. CONTRACT 60/22.03.17"
  const ctrMatch = clean.match(
    /^AVANS\s*(?:([0-9IVXLCDM]+%?|[0-9IVXLCDM]+|\d+%?)\s*)?(?:CONFORM|CONF\.?|CF\.?)\s*(?:CONTRACT|CTR\.?)\s*(?:NR\.?)?\s*([0-9\/\.\-\s\w]+)$/i
  );
  if (ctrMatch) {
    const pct = ctrMatch[1] ? `${ctrMatch[1]} ` : "";
    const ref = ctrMatch[2].trim().replace(/\s+/g, " ");
    return `Advance payment ${pct}according to Contract No. ${ref}`;
  }

  // 3. Advance for invoice:
  // e.g. "AVANS FACTURA WOODE 201/31.01.2018"
  const invMatch = clean.match(/^AVANS\s*(?:FACTURA|FACT\.?)\s*([0-9\/\.\-\s\w]+)$/i);
  if (invMatch) {
    return `Advance payment for invoice ${invMatch[1].trim()}`;
  }

  // 4. Staged delivery:
  // e.g. "TAMPLARIE LEMN STRATIFICAT ETAPA 1, CF.CTR.NR.381/08.07.2026"
  const stageMatch = clean.match(
    /^(.*?)\s*ETAPA\s*([0-9IVXLCDM]+)(?:,\s*(?:CF\.?|CONF\.?)\s*(?:CTR\.?|CONTRACT)\s*(?:NR\.?)?\s*(.*))?$/i
  );
  if (stageMatch) {
    const mainRo = stageMatch[1].trim();
    const stageNum = stageMatch[2].trim();
    const ctrRef = stageMatch[3] ? stageMatch[3].trim() : "";
    const translatedMain = COMMERCIAL_DICTIONARY[mainRo.toUpperCase()] || mainRo;
    if (ctrRef) {
      return `${translatedMain} Stage ${stageNum}, according to Contract No. ${ctrRef}`;
    }
    return `${translatedMain} Stage ${stageNum}`;
  }

  // 5. Already bilingual with parentheses:
  // e.g. "TAMPLARIE LEMN STRATIFICAT (Laminated woodwork)"
  const parenMatch = clean.match(/^(.*?)\s*\(([A-Za-z\s\d\.\-\/]+)\)$/);
  if (parenMatch && parenMatch[2].length > 2) {
    const candidate = parenMatch[2].trim();
    if (/[A-Za-z]{2,}/.test(candidate) && !candidate.startsWith("00")) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }
  }

  // 6. Already bilingual with slash:
  // e.g. "FEREASTRA LEMN / WOOD WINDOWS"
  // Must NOT match dates like "382/21.07.2026"
  const slashMatch = clean.match(/^(.*?)\s*\/\s*([A-Za-z\s\d\.\-]+)$/);
  if (slashMatch && slashMatch[2].length > 2) {
    const candidate = slashMatch[2].trim();
    if (/[A-Za-z]{3,}/.test(candidate) && !/^\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}$/.test(candidate)) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }
  }

  // 7. Simple generic "AVANS"
  if (upper === "AVANS") {
    return "Advance payment";
  }

  return null;
}

/**
 * Synchronous translation using dictionary, patterns and in-memory cache.
 * Always guaranteed not to block.
 */
export function translateProductDescriptionSync(description: string): string {
  if (!description || typeof description !== "string") return "";
  const trimmed = description.trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();

  // 1. Direct dictionary match
  if (COMMERCIAL_DICTIONARY[upper]) {
    return COMMERCIAL_DICTIONARY[upper];
  }

  // 2. Cache hit
  if (translationCache.has(upper)) {
    return translationCache.get(upper)!;
  }

  // 3. Pattern rules
  const patternResult = applyPatternRules(trimmed);
  if (patternResult) {
    translationCache.set(upper, patternResult);
    return patternResult;
  }

  return trimmed;
}

/**
 * Asynchronous translation for product descriptions.
 * Uses dictionary, pattern rules, and falls back to high-quality translation API.
 */
export async function translateProductDescription(description: string): Promise<string> {
  if (!description || typeof description !== "string") return "";
  const trimmed = description.trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();

  // 1. Check sync / dictionary / pattern first
  const syncResult = translateProductDescriptionSync(trimmed);
  if (syncResult && syncResult.toLowerCase() !== trimmed.toLowerCase()) {
    return syncResult;
  }

  // 2. Check if cached from a previous online translation
  if (translationCache.has(upper)) {
    return translationCache.get(upper)!;
  }

  // 3. Call Google GTX Translation API (free, fast, no auth required)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ro&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 3-second timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (SmartInvoice/1.0)",
      },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const fullTranslation = data[0]
          .map((chunk: any) => (chunk && chunk[0] ? chunk[0] : ""))
          .join("")
          .trim();

        if (fullTranslation && fullTranslation.toLowerCase() !== trimmed.toLowerCase()) {
          // Capitalize first letter neatly
          const formatted = fullTranslation.charAt(0).toUpperCase() + fullTranslation.slice(1);
          translationCache.set(upper, formatted);
          return formatted;
        }
      }
    }
  } catch (err) {
    // If network fails or times out, safely fall back
  }

  // Fallback: return the original description if translation is identical or unavailable
  return trimmed;
}
