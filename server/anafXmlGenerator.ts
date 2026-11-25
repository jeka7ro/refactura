import { ReInvoice, ReInvoiceLine, Tenant } from "../drizzle/schema";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "SE", "SI", "SK"
]);

/**
 * Generates an ANAF compliant UBL 2.1 e-Factura XML string (CIUS-RO).
 * Supports standard VAT, exemptions, reverse charge (AE), foreign EU/non-EU clients, and foreign currencies (EUR, USD, etc.).
 */
export function normalizeUblDate(raw?: string | Date | null, fallback?: string): string {
  if (!raw) return fallback || new Date().toISOString().split("T")[0];
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? (fallback || new Date().toISOString().split("T")[0]) : raw.toISOString().split("T")[0];
  }
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? (fallback || new Date().toISOString().split("T")[0]) : d.toISOString().split("T")[0];
}

function mapToUblUnitCode(rawUnit?: string | null): string {
  const trimmed = String(rawUnit || "").trim();
  const u = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\./g, "");
  if (!u) return "C62";
  if (["buc", "bucata", "bucati", "pce", "pcs", "h87"].includes(u)) return "H87";
  if (["ea", "c62", "unit", "serv", "serviciu", "servicii"].includes(u)) return "C62";
  if (["kg", "kgm", "kilogram", "kilograme"].includes(u)) return "KGM";
  if (["g", "gr", "grm", "gram", "grame"].includes(u)) return "GRM";
  if (["t", "to", "tne", "tona", "tone"].includes(u)) return "TNE";
  if (["mp", "m2", "m²", "mtk"].includes(u)) return "MTK";
  if (["ml", "m", "mtr", "metru", "metri"].includes(u)) return "MTR";
  if (["mc", "m3", "m³", "mtq"].includes(u)) return "MTQ";
  if (["l", "litru", "litri", "ltr"].includes(u)) return "LTR";
  if (["ore", "ora", "h", "hr", "hur"].includes(u)) return "HUR";
  if (["zi", "zile", "day"].includes(u)) return "DAY";
  if (["luna", "luni", "mon"].includes(u)) return "MON";
  if (["km", "kmt"].includes(u)) return "KMT";
  if (["set"].includes(u)) return "SET";
  if (/^[A-Z0-9]{2,3}$/.test(trimmed)) return trimmed;
  return "C62";
}

export function generateUblXml(
  invoice: ReInvoice & { clientCountry?: string | null },
  lines: ReInvoiceLine[],
  tenant: Tenant,
  exchangeRate?: number
): string {
  const issueDate = normalizeUblDate(invoice.issueDate);
  const dueDate = invoice.dueDate
    ? normalizeUblDate(invoice.dueDate, issueDate)
    : issueDate;

  let tenantSettings: any = {};
  try {
    if (tenant.settings) tenantSettings = JSON.parse(tenant.settings);
  } catch (e) {}

  const tenantCity = tenantSettings.city || "";
  const tenantRegCom = tenantSettings.regCom || "";
  const tenantCounty = tenantSettings.county || "";

  // Seller CUI: In Romania, VAT registered sellers must have RO prefix in BT-31 / CompanyID
  // Non-VAT sellers (!rawSellerCui.startsWith("RO") and totalVAT === 0 / non-VAT lines) must NOT get a fake RO prefix (BR-RO-040)
  const rawSellerCui = (tenant.cui || "").trim().toUpperCase();
  const cleanSellerDigits = rawSellerCui.replace(/[^0-9]/g, "");
  const isPfSeller =
    tenantSettings.entityType === "pf" ||
    (cleanSellerDigits.length === 13 && /^[1-9]\d{12}$/.test(cleanSellerDigits));
  const invTotalVat = Math.abs(parseFloat(String((invoice as any).totalVAT ?? "0")) || 0);
  const hasVatLines = lines.some(l => parseFloat(String(l.vatRate ?? "0")) > 0);
  const explicitVatPayer =
    tenantSettings.isVatPayer === true || tenantSettings.tva === true
      ? true
      : tenantSettings.isVatPayer === false || tenantSettings.tva === false
      ? false
      : null;
  const isSellerVatPayer =
    !isPfSeller &&
    explicitVatPayer !== false &&
    (rawSellerCui.startsWith("RO") ||
      explicitVatPayer === true ||
      (invTotalVat > 0.005 && hasVatLines));

  const supplierVatId = isSellerVatPayer ? `RO${cleanSellerDigits}` : cleanSellerDigits;

  // Buyer Country & CUI
  const rawClientCui = (invoice.clientCUI || "").trim().toUpperCase();
  let buyerCountry = (invoice.clientCountry || "").trim().toUpperCase();
  if (!buyerCountry || buyerCountry.length !== 2) {
    const match = rawClientCui.match(/^([A-Z]{2})/);
    if (match && (EU_COUNTRIES.has(match[1]) || match[1] === "RO")) {
      buyerCountry = match[1];
    } else {
      buyerCountry = "RO";
    }
  }

  const cleanBuyerDigits = rawClientCui.replace(/[^0-9]/g, "");
  const cleanBuyerCui = rawClientCui.replace(/[^A-Z0-9]/gi, "");
  const isB2C =
    !cleanBuyerDigits ||
    cleanBuyerDigits === "0000000000000" ||
    (cleanBuyerDigits.length === 13 && /^[1-9]\d{12}$/.test(cleanBuyerDigits));

  // Determine buyer VAT status:
  // In Romania, a company has a VAT identifier (BT-48) ONLY if registered for VAT (RO prefix).
  // Non-VAT companies (art. 310) must NOT have PartyTaxScheme, otherwise ANAF rejects with BR-RO-040!
  const isBuyerVatPayer =
    !isB2C &&
    buyerCountry === "RO" &&
    (rawClientCui.startsWith("RO") || (invoice as any).clientTva === 1 || (invoice as any).clientTva === true);

  let buyerTaxSchemeXml = "";
  let buyerLegalId = "";

  if (buyerCountry === "RO") {
    if (isB2C) {
      buyerLegalId = "0000000000000";
    } else if (isBuyerVatPayer) {
      const vatId = `RO${cleanBuyerDigits}`;
      buyerTaxSchemeXml = `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${vatId}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>`;
      buyerLegalId = vatId;
    } else {
      // Non-VAT Romanian entity: no PartyTaxScheme, numeric CUI in LegalEntity
      buyerLegalId = cleanBuyerDigits || "0000000000000";
    }
  } else if (EU_COUNTRIES.has(buyerCountry)) {
    const vatCountryPrefix = buyerCountry === "GR" ? "EL" : buyerCountry;
    const euVatId = cleanBuyerCui.startsWith(vatCountryPrefix)
      ? cleanBuyerCui
      : vatCountryPrefix + cleanBuyerCui;
    buyerTaxSchemeXml = `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${euVatId}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>`;
    buyerLegalId = euVatId;
  } else {
    buyerLegalId = cleanBuyerCui || "UNKNOWN";
  }

  // Reverse charge detection
  const notesLower = (invoice.notes || "").toLowerCase();
  const isReverseCharge =
    notesLower.includes("reverse charge") ||
    notesLower.includes("taxare inversa") ||
    notesLower.includes("taxare inversă") ||
    notesLower.includes("art. 196") ||
    notesLower.includes("art. 331") ||
    notesLower.includes("art. 307") ||
    (buyerCountry !== "RO" && EU_COUNTRIES.has(buyerCountry));

  // BR-RO-110: Map Romanian city/county to ISO 3166-2:RO subdivision code
  const COUNTY_MAP: Record<string, string> = {
    "alba": "RO-AB", "arad": "RO-AR", "arges": "RO-AG", "bacau": "RO-BC",
    "bihor": "RO-BH", "bistrita": "RO-BN", "nasaud": "RO-BN", "botosani": "RO-BT", "brasov": "RO-BV",
    "braila": "RO-BR", "buzau": "RO-BZ", "caras": "RO-CS", "severin": "RO-CS",
    "calarasi": "RO-CL", "cluj": "RO-CJ", "constanta": "RO-CT", "covasna": "RO-CV",
    "dambovita": "RO-DB", "dolj": "RO-DJ", "galati": "RO-GL", "giurgiu": "RO-GR",
    "gorj": "RO-GJ", "harghita": "RO-HR", "hunedoara": "RO-HD", "ialomita": "RO-IL",
    "iasi": "RO-IS", "ilfov": "RO-IF", "maramures": "RO-MM", "mehedinti": "RO-MH",
    "mures": "RO-MS", "neamt": "RO-NT", "olt": "RO-OT", "prahova": "RO-PH",
    "satu": "RO-SM", "salaj": "RO-SJ", "sibiu": "RO-SB", "suceava": "RO-SV",
    "teleorman": "RO-TR", "timis": "RO-TM", "tulcea": "RO-TL",
    "vaslui": "RO-VS", "valcea": "RO-VL", "vrancea": "RO-VN",
  };

  const VALID_COUNTY_CODES = new Set(Object.values(COUNTY_MAP));

  const matchCountyToken = (rawText?: string | null): string | null => {
    if (!rawText) return null;
    const key = String(rawText)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
    if (!key) return null;

    const upper = key.toUpperCase();
    if (upper === "B" || upper === "RO-B") return "RO-B";
    if (VALID_COUNTY_CODES.has(upper)) return upper;
    if (/^[A-Z]{2}$/.test(upper) && VALID_COUNTY_CODES.has(`RO-${upper}`)) {
      return `RO-${upper}`;
    }

    if (/\b(?:bucuresti|bucharest|sector\s*[1-6]|sectorul\s*[1-6])\b/i.test(key)) {
      return "RO-B";
    }

    for (const [k, v] of Object.entries(COUNTY_MAP)) {
      if (new RegExp(`\\b${k}\\b`, "i").test(key)) return v;
    }
    return null;
  };

  const getCountyCode = (county?: string | null, city?: string | null, address?: string | null): string => {
    const fromCounty = matchCountyToken(county);
    if (fromCounty) return fromCounty;

    const fromCity = matchCountyToken(city);
    if (fromCity) return fromCity;

    if (address) {
      const strippedAddr = String(address)
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\b(?:strada|str\.|calea|bd\.|bulevardul|sos\.|soseaua)\s+\S+/gi, " ");
      const fromAddr = matchCountyToken(strippedAddr);
      if (fromAddr) return fromAddr;
    }

    return "RO-B"; // fallback
  };

  // BR-RO-100: When subdivision is RO-B (Bucharest), city must be SECTOR1...SECTOR6
  const getSectorOrCity = (subdivision: string, address: string, city: string): string => {
    if (subdivision !== "RO-B") return city || "Nesetata";
    const sectorMatch = (address + " " + city).match(/sector\s*([1-6])/i);
    if (sectorMatch) return `SECTOR${sectorMatch[1]}`;
    return "SECTOR1";
  };

  // Match county and city with word boundaries BEFORE checking street-stripped address
  const sellerSubdivision = getCountyCode(tenantCounty, tenantCity, tenant.address || "");
  const sellerCity = getSectorOrCity(sellerSubdivision, tenant.address || "", tenantCity);

  let buyerAddressXml = "";
  if (buyerCountry === "RO") {
    const clientCounty = (invoice as any).clientCounty || "";
    const clientCity = (invoice as any).clientCity || "";
    const clientAddress = (invoice as any).clientAddress || "";
    const buyerSubdivision = getCountyCode(clientCounty, clientCity, clientAddress);
    const buyerCity = getSectorOrCity(buyerSubdivision, clientAddress, clientCity);
    buyerAddressXml = `
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(clientAddress || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml(buyerCity)}</cbc:CityName>
                <cbc:CountrySubentity>${buyerSubdivision}</cbc:CountrySubentity>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>`;
  } else {
    buyerAddressXml = `
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml((invoice as any).clientAddress || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml((invoice as any).clientCity || "Nesetata")}</cbc:CityName>
                ${(invoice as any).clientCounty ? `<cbc:CountrySubentity>${escapeXml((invoice as any).clientCounty)}</cbc:CountrySubentity>` : ""}
                <cac:Country>
                    <cbc:IdentificationCode>${buyerCountry}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>`;
  }

  // Calculate tax subtotals and line totals with exact decimal rounding
  const taxGroups = new Map<
    number,
    { taxableAmount: number; taxAmount: number }
  >();

  let sumLineExtension = 0;

  // Generate lines
  const xmlLines = lines
    .map((line, idx) => {
      const rawQty = parseFloat(String(line.quantity ?? "0")) || 0;
      const rawUnitPrice = parseFloat(String(line.unitPrice ?? "0")) || 0;
      const explicitLineTotal =
        line.total !== undefined && line.total !== null && String(line.total).trim() !== ""
          ? parseFloat(String(line.total))
          : NaN;

      // Prevent double-negative storno sign flip (rawQty < 0 && rawUnitPrice < 0)
      const isNegativeLine =
        (Number.isFinite(explicitLineTotal) && explicitLineTotal < 0) ||
        rawQty < 0 ||
        rawUnitPrice < 0;
      const absQty = Math.abs(rawQty);
      let absUnitPrice = Math.abs(rawUnitPrice);

      // Rule BR-CO-10: format unitPrice with up to 4 decimals when needed so qty * unitPrice matches lineTotal
      if (Number.isFinite(explicitLineTotal) && absQty > 0) {
        const targetAbsTotal = Math.round(Math.abs(explicitLineTotal) * 100) / 100;
        const calc2 = Math.round(absQty * (Math.round(absUnitPrice * 100) / 100) * 100) / 100;
        const calc4 = Math.round(absQty * (Math.round(absUnitPrice * 10000) / 10000) * 100) / 100;
        if (calc2 !== targetAbsTotal && calc4 !== targetAbsTotal) {
          const derived4 = Math.round((targetAbsTotal / absQty) * 10000) / 10000;
          if (
            Math.round(absQty * derived4 * 100) / 100 === targetAbsTotal &&
            Math.abs(derived4 - absUnitPrice) <= 0.05
          ) {
            absUnitPrice = derived4;
          }
        }
      }

      const roundedPrice2 = Math.round(absUnitPrice * 100) / 100;
      const roundedPrice4 = Math.round(absUnitPrice * 10000) / 10000;
      const needsMoreDecimals =
        Math.abs(roundedPrice4 - roundedPrice2) > 1e-6 ||
        (Number.isFinite(explicitLineTotal) &&
          absQty > 0 &&
          Math.round(absQty * roundedPrice2 * 100) / 100 !== Math.round(Math.abs(explicitLineTotal) * 100) / 100 &&
          Math.round(absQty * roundedPrice4 * 100) / 100 === Math.round(Math.abs(explicitLineTotal) * 100) / 100);
      const unitPriceStr = needsMoreDecimals
        ? roundedPrice4.toFixed(4).replace(/0+$/, "").replace(/(\.\d)$/, "$10")
        : roundedPrice2.toFixed(2);
      const effectiveUnitPrice = parseFloat(unitPriceStr);

      // Rule BR-27: Item net price (BT-146) must NOT be negative.
      // Negative signs for storno/discounts belong strictly on the quantity.
      const roundedQty2 = Math.round(absQty * 100) / 100;
      const roundedQty4 = Math.round(absQty * 10000) / 10000;
      const signedQty4 = isNegativeLine && absQty > 0 ? -roundedQty4 : roundedQty4;
      const signedQty2 = isNegativeLine && absQty > 0 ? -roundedQty2 : roundedQty2;
      const qtyStr =
        Math.abs(roundedQty4 - roundedQty2) > 1e-6
          ? signedQty4.toFixed(4).replace(/0+$/, "").replace(/(\.\d)$/, "$10")
          : signedQty2.toFixed(2);
      const effectiveQty = parseFloat(qtyStr);

      const lineTotal = Math.round(effectiveQty * effectiveUnitPrice * 100) / 100;
      sumLineExtension += lineTotal;

      const vatRate = isSellerVatPayer ? parseFloat(String(line.vatRate ?? "0")) : 0;
      const lineVat = Math.round(lineTotal * (vatRate / 100) * 100) / 100;
      const unitCode = mapToUblUnitCode((line as any).unit);

      if (!taxGroups.has(vatRate)) {
        taxGroups.set(vatRate, { taxableAmount: 0, taxAmount: 0 });
      }
      const group = taxGroups.get(vatRate)!;
      group.taxableAmount += lineTotal;
      group.taxAmount += lineVat;

      let taxCategoryId = "S";
      if (!isSellerVatPayer) {
        taxCategoryId = "O";
      } else if (vatRate === 0) {
        taxCategoryId = isReverseCharge ? "AE" : "E";
      }

      return `
    <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${unitCode}">${qtyStr}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${invoice.currency}">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>${escapeXml(line.description)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${taxCategoryId}</cbc:ID>${taxCategoryId !== "O" ? `
                <cbc:Percent>${vatRate.toFixed(2)}</cbc:Percent>` : ""}
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${invoice.currency}">${unitPriceStr}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join("");

  sumLineExtension = Math.round(sumLineExtension * 100) / 100;

  // Generate tax subtotals (BR-S-09: TaxAmount = round(TaxableAmount * rate / 100, 2))
  let sumTaxAmount = 0;
  const xmlTaxSubtotals = Array.from(taxGroups.entries())
    .map(([rate, group]) => {
      const taxable = Math.round(group.taxableAmount * 100) / 100;
      const tax = !isSellerVatPayer || rate === 0
        ? 0
        : Math.round(taxable * (rate / 100) * 100) / 100;
      sumTaxAmount += tax;

      let taxCategoryId = "S";
      let exemptionCode = "";
      let exemptionReason = "";

      if (!isSellerVatPayer) {
        taxCategoryId = "O";
        exemptionCode = "VATEX-EU-O";
        exemptionReason = invoice.notes?.trim() || "Entitate neinregistrata in scopuri de TVA";
      } else if (rate === 0) {
        if (isReverseCharge) {
          taxCategoryId = "AE";
          exemptionCode = "VATEX-EU-AE";
          exemptionReason = invoice.notes?.trim() || "Taxare inversa conform art. 196 din Directiva 2006/112/CE";
        } else {
          taxCategoryId = "E";
          exemptionCode = "VATEX-EU-E";
          exemptionReason = invoice.notes?.trim() || "Scutit de TVA conform Codului Fiscal";
        }
      }

      return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${invoice.currency}">${taxable.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${invoice.currency}">${tax.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${taxCategoryId}</cbc:ID>${taxCategoryId !== "O" ? `
                <cbc:Percent>${rate.toFixed(2)}</cbc:Percent>` : ""}
                ${rate === 0 || !isSellerVatPayer ? `<cbc:TaxExemptionReasonCode>${exemptionCode}</cbc:TaxExemptionReasonCode>
                <cbc:TaxExemptionReason>${escapeXml(exemptionReason)}</cbc:TaxExemptionReason>` : ""}
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    })
    .join("");

  sumTaxAmount = Math.round(sumTaxAmount * 100) / 100;
  const finalTaxInclusive = Math.round((sumLineExtension + sumTaxAmount) * 100) / 100;

  // Foreign currency support (BR-RO-030): TaxCurrencyCode must be RON, second TaxTotal in RON must exist
  const isForeignCurrency = invoice.currency && invoice.currency !== "RON";
  if (isForeignCurrency && sumTaxAmount !== 0 && !(exchangeRate && exchangeRate > 0)) {
    throw new Error(
      `Cursul BNR pentru ${invoice.currency} nu a putut fi determinat; TVA în RON (BR-RO-030) nu poate fi calculat.`
    );
  }
  const vatInRon = isForeignCurrency
    ? (sumTaxAmount === 0 ? 0 : Math.round(sumTaxAmount * (exchangeRate as number) * 100) / 100)
    : sumTaxAmount;

  // Supplier IBAN and Bank for PaymentMeans (BR-RO CIUS-RO compliant)
  let supplierIban = ((invoice as any).companyIBAN || "").trim().replace(/\s+/g, "").toUpperCase();
  let supplierBank = ((invoice as any).companyBank || "").trim();

  if (!supplierIban && tenant.settings) {
    try {
      const s = typeof tenant.settings === "string" ? JSON.parse(tenant.settings) : tenant.settings;
      const invCur = (invoice.currency || "RON").toUpperCase();
      if (Array.isArray(s.bankAccounts) && s.bankAccounts.length > 0) {
        const matchingAcc = s.bankAccounts.find((a: any) => (a.currency || "RON").toUpperCase() === invCur && a.iban);
        if (matchingAcc) {
          supplierIban = String(matchingAcc.iban).trim().replace(/\s+/g, "").toUpperCase();
          supplierBank = matchingAcc.bank ? String(matchingAcc.bank).trim() : supplierBank;
        }
      }
      if (!supplierIban && invCur === "EUR" && s.ibanEur) {
        supplierIban = String(s.ibanEur).trim().replace(/\s+/g, "").toUpperCase();
        supplierBank = s.bankEur ? String(s.bankEur).trim() : supplierBank;
      }
      if (!supplierIban && s.iban) {
        supplierIban = String(s.iban).trim().replace(/\s+/g, "").toUpperCase();
        supplierBank = s.bank ? String(s.bank).trim() : supplierBank;
      }
    } catch {}
  }

  const isValidIban = supplierIban.length >= 15 && /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(supplierIban);

  const paymentMeansXml = isValidIban
    ? `
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
        <cbc:PaymentID>${escapeXml(invoice.number)}</cbc:PaymentID>
        <cac:PayeeFinancialAccount>
            <cbc:ID>${escapeXml(supplierIban)}</cbc:ID>
        </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>
    <cac:PaymentTerms>
        <cbc:Note>Plata prin virament bancar in contul ${escapeXml(supplierIban)}${
          supplierBank ? ` (${escapeXml(supplierBank)})` : ""
        }, scadenta ${dueDate}.</cbc:Note>
    </cac:PaymentTerms>`
    : "";

  // Build the full XML
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
    <cbc:ID>${escapeXml(invoice.number)}</cbc:ID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:DueDate>${dueDate}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    ${invoice.notes ? `<cbc:Note>${escapeXml(invoice.notes)}</cbc:Note>` : ""}
    <cbc:DocumentCurrencyCode>${invoice.currency}</cbc:DocumentCurrencyCode>
    ${isForeignCurrency ? `<cbc:TaxCurrencyCode>RON</cbc:TaxCurrencyCode>` : ""}

    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(tenant.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(tenant.address || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml(sellerCity)}</cbc:CityName>
                <cbc:CountrySubentity>${sellerSubdivision}</cbc:CountrySubentity>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            ${isSellerVatPayer ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${supplierVatId}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : ""}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(tenant.name)}</cbc:RegistrationName>
                <cbc:CompanyID>${supplierVatId}</cbc:CompanyID>
                ${tenantRegCom ? `<cbc:CompanyLegalForm>${escapeXml(tenantRegCom)}</cbc:CompanyLegalForm>` : ""}
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(invoice.clientName)}</cbc:Name>
            </cac:PartyName>${buyerAddressXml}${buyerTaxSchemeXml}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(invoice.clientName)}</cbc:RegistrationName>
                <cbc:CompanyID>${buyerLegalId}</cbc:CompanyID>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>${paymentMeansXml}

    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${invoice.currency}">${sumTaxAmount.toFixed(2)}</cbc:TaxAmount>${xmlTaxSubtotals}
    </cac:TaxTotal>
    ${isForeignCurrency ? `
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="RON">${vatInRon.toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>` : ""}

    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${invoice.currency}">${sumLineExtension.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${invoice.currency}">${sumLineExtension.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${invoice.currency}">${finalTaxInclusive.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${invoice.currency}">${finalTaxInclusive.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${xmlLines}
</Invoice>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

