/**
 * FirmeAPI.ro Service
 * Integrates https://www.firmeapi.ro API v1 for Romanian Company Intelligence & Balance Sheets
 */

const FIRME_API_BASE_URL = "https://www.firmeapi.ro/api/v1";

export interface FirmeApiAddress {
  strada?: string;
  numar?: string;
  localitate?: string;
  judet?: string;
  cod_postal?: string;
  tara?: string;
  detalii?: string;
}

export interface FirmeApiTvaPeriod {
  data_inceput_ScpTVA?: string | null;
  data_sfarsit_ScpTVA?: string | null;
  data_anul_imp_ScpTVA?: string | null;
  mesaj_ScpTVA?: string;
}

export interface FirmeApiGeneralData {
  cui: number | string;
  denumire: string;
  data_inregistrare?: string;
  stare?: string;
  cod_caen?: string;
  nr_reg_com?: string;
  telefon?: string;
  fax?: string;
  cod_postal?: string;
  adresa?: string;
  forma_de_proprietate?: string;
  forma_juridica?: string;
  iban?: string;
  e_factura?: boolean;
  e_factura_data_inregistrare?: string | null;
  data_actualizare?: string;
  adresa_sediu_social?: FirmeApiAddress;
  adresa_domiciliu_fiscal?: FirmeApiAddress;
  tva?: {
    platitor: boolean;
    perioade?: FirmeApiTvaPeriod[];
  };
  tva_incasare?: {
    activ: boolean;
    data_inceput?: string | null;
    data_sfarsit?: string | null;
  };
  split_tva?: {
    activ: boolean;
  };
  status_inactiv?: {
    inactiv: boolean;
    data_inactivare?: string | null;
    data_reactivare?: string | null;
    data_radiere?: string | null;
  };
  organ_fiscal?: string;
  forma_organizare?: string;
}

export interface YearlyBilantFinancials {
  an: number;
  cui: number;
  denumire?: string;
  caen?: number;
  denumire_caen?: string;
  cifraAfaceri: number;
  venituriTotale: number;
  cheltuieliTotale: number;
  profitNet: number;
  pierdereNeta: number;
  angajati: number;
  activeImobilizate: number;
  activeCirculante: number;
  stocuri: number;
  creante: number;
  casaSiConturi: number;
  datorii: number;
  capitaluriProprii: number;
  detaliiRaw?: Array<{ indicator: string; val_indicator: number; val_den_indicator: string }>;
}

export interface FirmeApiHolding {
  name: string;
  entity: "PF" | "PJ" | string;
  type: string;
  is_administrator: boolean;
  percent: number;
  from: string;
  to: string | null;
  current: boolean;
  placeofbirth?: string | null;
  branch?: string | null;
}

export interface FirmeApiAdministrator {
  nume: string;
  tip?: string;
  calitate?: string;
  stare?: string;
  data?: string;
  loc_nastere?: string;
}

export interface FirmeApiCaenData {
  caen_principal?: {
    cod: string;
    denumire: string;
  };
  caen_secundare?: Array<{
    cod: string;
    denumire: string;
  }>;
  total_secundare?: number;
}

export interface FirmeApiMofEntry {
  numar?: string | number;
  data?: string;
  titlu_publicatie?: string;
  continut?: string;
}

export interface FirmeApiContactData {
  telefon?: string;
  email?: string;
  website?: string;
  fax?: string;
}

export interface FirmeApiCompanyReport {
  cui: string;
  general: FirmeApiGeneralData | null;
  financials: YearlyBilantFinancials[]; // Sorted by year descending (latest first)
  holdings: FirmeApiHolding[];
  administrators: FirmeApiAdministrator[];
  caen: FirmeApiCaenData | null;
  mof: FirmeApiMofEntry[];
  contacts: FirmeApiContactData | null;
  cachedAt: number;
  rawErrors?: Record<string, string>;
}

// In-Memory Cache with 24 Hours TTL
interface CacheEntry {
  data: FirmeApiCompanyReport;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

function getApiKey(): string {
  return process.env.FIRME_API_KEY || "aavxuyzk-zd6dalif-pnzngggl-4oza1mof";
}

export function sanitizeCui(cui: string | number): string {
  const str = String(cui).trim().toUpperCase();
  return str.replace(/\D/g, "");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFromFirmeApi<T>(
  endpoint: string,
  cuiDigits: string,
  retries = 2
): Promise<T | null> {
  const apiKey = getApiKey();
  const url = `${FIRME_API_BASE_URL}/${endpoint}/${cuiDigits}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(attempt * 250);
      }

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json",
        },
      });

      if (res.status === 404) return null;

      if (!res.ok) {
        if (attempt < retries && (res.status === 500 || res.status === 502 || res.status === 429)) {
          continue;
        }
        console.warn(`[FirmeAPI] ${endpoint}/${cuiDigits} responded with status ${res.status}`);
        return null;
      }

      const json = await res.json();
      return json as T;
    } catch (err: any) {
      if (attempt < retries) continue;
      console.error(`[FirmeAPI] Error fetching ${endpoint}/${cuiDigits}:`, err?.message || err);
      return null;
    }
  }

  return null;
}

function parseBilantData(bilantResponse: any): YearlyBilantFinancials[] {
  if (!bilantResponse) return [];
  const rawData = bilantResponse.data?.ani || bilantResponse.data || bilantResponse.ani || {};
  const years = Object.keys(rawData).filter((k) => /^\d{4}$/.test(k));

  const results: YearlyBilantFinancials[] = [];

  for (const yr of years) {
    const yrData = rawData[yr];
    if (!yrData || !yrData.detalii) continue;

    const indicatorsMap: Record<string, number> = {};
    for (const ind of yrData.detalii) {
      if (ind.indicator && ind.val_indicator !== undefined) {
        indicatorsMap[ind.indicator] = ind.val_indicator;
      }
    }

    results.push({
      an: yrData.an || parseInt(yr, 10),
      cui: yrData.cui,
      denumire: yrData.denumire,
      caen: yrData.caen,
      denumire_caen: yrData.denumire_caen,
      cifraAfaceri: indicatorsMap["I13"] ?? 0,
      venituriTotale: indicatorsMap["I14"] ?? 0,
      cheltuieliTotale: indicatorsMap["I15"] ?? 0,
      profitNet: indicatorsMap["I18"] ?? 0,
      pierdereNeta: indicatorsMap["I19"] ?? 0,
      angajati: indicatorsMap["I20"] ?? 0,
      activeImobilizate: indicatorsMap["I1"] ?? 0,
      activeCirculante: indicatorsMap["I2"] ?? 0,
      stocuri: indicatorsMap["I3"] ?? 0,
      creante: indicatorsMap["I4"] ?? 0,
      casaSiConturi: indicatorsMap["I5"] ?? 0,
      datorii: indicatorsMap["I7"] ?? 0,
      capitaluriProprii: indicatorsMap["I10"] ?? 0,
      detaliiRaw: yrData.detalii,
    });
  }

  // Sort descending by year (2025, 2024, 2023...)
  return results.sort((a, b) => b.an - a.an);
}

export async function getCompanyFullDossier(
  rawCui: string | number,
  forceRefresh = false
): Promise<FirmeApiCompanyReport | null> {
  const cuiDigits = sanitizeCui(rawCui);
  if (!cuiDigits) {
    return null;
  }

  const now = Date.now();
  if (!forceRefresh) {
    const cached = cache.get(cuiDigits);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Execute all 7 queries concurrently with allSettled
  const [
    firmaRes,
    bilantRes,
    actionariRes,
    adminRes,
    caenRes,
    mofRes,
    contactRes,
  ] = await Promise.allSettled([
    fetchFromFirmeApi<any>("firma", cuiDigits),
    fetchFromFirmeApi<any>("bilant", cuiDigits),
    fetchFromFirmeApi<any>("actionari", cuiDigits),
    fetchFromFirmeApi<any>("administratori", cuiDigits),
    fetchFromFirmeApi<any>("caen", cuiDigits),
    fetchFromFirmeApi<any>("mof", cuiDigits),
    fetchFromFirmeApi<any>("datecontact", cuiDigits),
  ]);

  const errors: Record<string, string> = {};

  // Extract Firma General Data
  let general: FirmeApiGeneralData | null = null;
  if (firmaRes.status === "fulfilled" && firmaRes.value) {
    general = firmaRes.value.data || firmaRes.value;
  } else if (firmaRes.status === "rejected") {
    errors["firma"] = String(firmaRes.reason);
  }

  // Extract Bilant
  let financials: YearlyBilantFinancials[] = [];
  if (bilantRes.status === "fulfilled" && bilantRes.value) {
    financials = parseBilantData(bilantRes.value);
  }

  // Extract Actionari
  let holdings: FirmeApiHolding[] = [];
  if (actionariRes.status === "fulfilled" && actionariRes.value) {
    holdings = actionariRes.value.holdings || actionariRes.value.data || [];
  }

  // Extract Administratori
  let administrators: FirmeApiAdministrator[] = [];
  if (adminRes.status === "fulfilled" && adminRes.value) {
    administrators =
      adminRes.value.data?.administratori ||
      adminRes.value.administratori ||
      [];
  }

  // Extract CAEN
  let caen: FirmeApiCaenData | null = null;
  if (caenRes.status === "fulfilled" && caenRes.value) {
    const caenData = caenRes.value.data || caenRes.value;
    caen = {
      caen_principal: caenData.caen_principal,
      caen_secundare: caenData.caen_secundare || [],
      total_secundare: caenData.total_secundare || caenData.caen_secundare?.length || 0,
    };
  }

  // Extract MOF
  let mof: FirmeApiMofEntry[] = [];
  if (mofRes.status === "fulfilled" && mofRes.value) {
    const rawMof = mofRes.value.data?.rezultate || mofRes.value.rezultate || [];
    mof = rawMof.map((r: any) => ({
      numar: r.publicatieNr || r.numar,
      data: r.data,
      titlu_publicatie: r.titlu_publicatie || r.titlu,
      continut: r.continut,
    }));
  }

  // Extract Contact
  let contacts: FirmeApiContactData | null = null;
  if (contactRes.status === "fulfilled" && contactRes.value && contactRes.value.success) {
    contacts = contactRes.value.data || null;
  }

  const report: FirmeApiCompanyReport = {
    cui: cuiDigits,
    general,
    financials,
    holdings,
    administrators,
    caen,
    mof,
    contacts,
    cachedAt: now,
    rawErrors: Object.keys(errors).length > 0 ? errors : undefined,
  };

  cache.set(cuiDigits, {
    data: report,
    timestamp: now,
  });

  return report;
}
