/**
 * Compiler universal pentru contracte și acte adiționale
 * Suport complet pentru Română (RO), Engleză (EN) și Bilingv (RO + EN)
 */

export type ContractLanguage = "ro" | "en" | "ro_en";

export interface CompileTemplateParams {
  rawHtml: string;
  tenant: any;
  tenantSettings: any;
  partner: any;
  partnerContactName?: string;
  partnerPhone?: string;
  partnerEmail?: string;
  docNumber: string;
  docDate: string;
  docValue: string;
  docCurrency: string;
  paymentTermDays: string;
  deliveryDays: string;
  warrantyMonths: string;
  contractObject: string;
  explanation: string;
  parentContract: any;
  hasTrial?: boolean;
  trialMonths?: number;
  hasPromo?: boolean;
  promoPrice?: string;
  promoMonths?: number;
  basePrice?: string;
  totalDurationMonths?: number;
  autoRenewalMonths?: number;
  docLanguage?: ContractLanguage;
  // Wood Glass specific parameters
  woodEssence?: string;
  offerNumber?: string;
  offerDate?: string;
  warrantyYears?: string;
  paymentTranches?: "50-40-10" | "50-50";
  wgTransportIncluded?: "da" | "nu";
  wgMarketType?: "intern" | "extern";
  wgBeneficiaryType?: "pf" | "pj";
}

export function compileContractTemplate({
  rawHtml,
  tenant,
  tenantSettings,
  partner,
  partnerContactName = "",
  partnerPhone = "",
  partnerEmail = "",
  docNumber,
  docDate,
  docValue,
  docCurrency,
  paymentTermDays,
  deliveryDays,
  warrantyMonths,
  contractObject,
  explanation,
  parentContract,
  hasTrial = false,
  trialMonths = 1,
  hasPromo = true,
  promoPrice = "3.50",
  promoMonths = 3,
  basePrice = "4.00",
  totalDurationMonths = 15,
  autoRenewalMonths = 12,
  docLanguage = "ro",
  woodEssence = "Tâmplărie lemn stratificat, esență meranti, 68 mm",
  offerNumber = "",
  offerDate = "",
  warrantyYears = "3",
  paymentTranches,
  wgTransportIncluded = "da",
  wgMarketType = "extern",
  wgBeneficiaryType = "pj",
}: CompileTemplateParams): string {
  let raw = rawHtml || "";

  const isEn = docLanguage === "en";
  const isBilingual = docLanguage === "ro_en";

  const activeTenantName = tenant?.name || "Compania Ta";
  const isTradeInvest =
    tenant?.id === 1 ||
    String(tenant?.cui || tenantSettings?.cui || "").includes("42322117") ||
    activeTenantName.toUpperCase().includes("TRADE INVEST");
  const isWoodGlass =
    tenant?.id === 4 ||
    String(tenant?.cui || tenantSettings?.cui || "").includes("28396216") ||
    activeTenantName.toUpperCase().includes("WOOD GLASS");

  const activeTenantCui =
    tenant?.cui ||
    tenantSettings?.cui ||
    tenantSettings?.fiscalCode ||
    (isTradeInvest ? "RO42322117" : isWoodGlass ? "RO28396216" : "-");
  const activeTenantRegCom =
    tenantSettings?.regCom ||
    (isTradeInvest ? "J2020002825409" : isWoodGlass ? "J2011000729084" : "-");
  const activeTenantCity =
    tenantSettings?.city || (isWoodGlass ? "Brașov" : isTradeInvest ? "București" : "-");
  const activeTenantAddress =
    tenant?.address ||
    tenantSettings?.address ||
    (isWoodGlass ? "Str. Zizinului nr. 625" : "-");
  const activeTenantIban =
    tenantSettings?.iban ||
    (isTradeInvest
      ? "RO31BACX0000001999343001"
      : isWoodGlass
      ? "RO43INGB0000999915654676"
      : "-");
  const activeTenantIbanEur =
    tenantSettings?.ibanEur ||
    (isTradeInvest
      ? "RO04BACX0000001999343002"
      : isWoodGlass
      ? "RO59INGB0000999915654679"
      : activeTenantIban);
  const activeTenantBank =
    tenantSettings?.bank ||
    (isTradeInvest ? "Unicredit" : isWoodGlass ? "ING Brașov" : "-");
  const activeTenantDelegat =
    tenantSettings?.representative ||
    tenantSettings?.delegat ||
    (isWoodGlass
      ? "dl. Șaran Vitalie, Administrator"
      : isTradeInvest
      ? "Elena Cazmal, Administrator"
      : "Administrator");
  const activeTenantPhone =
    tenant?.phone ||
    tenantSettings?.phone ||
    (isWoodGlass ? "0742258807" : isTradeInvest ? "+40 757 77 77 12" : "-");
  const activeTenantEmail =
    tenant?.email ||
    tenantSettings?.email ||
    (isWoodGlass ? "rowoodbv@gmail.com" : isTradeInvest ? "contact@getapp.ro" : "-");

  // Inlocuire date Furnizor (Tenant)
  raw = raw
    .replace(/{{tenant\.name}}/g, activeTenantName)
    .replace(/{{tenant\.cui}}/g, activeTenantCui.startsWith("RO") || activeTenantCui === "-" ? activeTenantCui : `RO${activeTenantCui}`)
    .replace(/{{tenant\.regCom}}/g, activeTenantRegCom)
    .replace(/{{tenant\.j}}/g, activeTenantRegCom)
    .replace(/{{tenant\.rc}}/g, activeTenantRegCom)
    .replace(/{{J_Furnizor}}/g, activeTenantRegCom)
    .replace(/{{tenant\.city}}/g, activeTenantCity)
    .replace(/{{tenant\.address}}/g, activeTenantAddress)
    .replace(/{{tenant\.iban}}/g, activeTenantIban)
    .replace(/{{tenant\.ibanEur}}/g, activeTenantIbanEur)
    .replace(/{{tenant\.bank}}/g, activeTenantBank)
    .replace(/{{tenant\.delegat}}/g, activeTenantDelegat)
    .replace(/{{tenant\.phone}}/g, activeTenantPhone)
    .replace(/{{tenant\.email}}/g, activeTenantEmail);

  // Inlocuire date Beneficiar (Partener SAGA / Client)
  const clientRep =
    partnerContactName?.trim() ||
    (partner ? partner.contactPerson || partner.delegat || "Administrator" : "Administrator");
  const clientPhone = partnerPhone?.trim() || (partner ? partner.phone || partner.clientPhone || "-" : "-");
  const clientEmail = partnerEmail?.trim() || (partner ? partner.email || partner.clientEmail || "-" : "-");

  const partnerName = partner ? (partner.name || partner.clientName || "").trim() : "";
  const partnerCui = partner ? (partner.cui || partner.clientCUI || "").trim() : "";
  const partnerRegCom = partner ? (partner.regCom || partner.clientRegCom || "").trim() : "";
  const partnerCity = partner ? (partner.city || partner.clientCity || "").trim() : "";
  const partnerAddress = partner ? (partner.address || partner.clientAddress || "").trim() : "";
  const partnerIban = partner ? (partner.iban || partner.companyIBAN || partner.bankAccount || "").trim() : "";
  const partnerBank = partner ? (partner.bank || partner.companyBank || partner.bankName || "").trim() : "";

  if (partner && partnerName) {
    const partnerClean = partnerName.replace(/S\.?C\.?|\bSRL\b|\bS\.R\.L\./gi, "").trim();
    const partnerSubdomain = partnerClean.toLowerCase().replace(/[^a-z0-9]/g, "") || "client";

    raw = raw
      .replace(/{{partner\.name}}/g, partnerName)
      .replace(/{{partner\.cui}}/g, partnerCui || "-")
      .replace(/{{partner\.regCom}}/g, partnerRegCom || "-")
      .replace(/{{partner\.j}}/g, partnerRegCom || "-")
      .replace(/{{partner\.rc}}/g, partnerRegCom || "-")
      .replace(/{{J_Client}}/g, partnerRegCom || "-")
      .replace(/{{partner\.city}}/g, partnerCity || "-")
      .replace(/{{partner\.address}}/g, partnerAddress || "-")
      .replace(/{{partner\.iban}}/g, partnerIban || "-")
      .replace(/{{partner\.bank}}/g, partnerBank || "-")
      .replace(/{{partner\.subdomain}}/g, partnerSubdomain)
      .replace(/{{partner\.slug}}/g, partnerSubdomain)
      .replace(/{{partner\.delegat}}/g, clientRep)
      .replace(/{{partner\.reprezentant}}/g, clientRep)
      .replace(/{{partner\.contactName}}/g, clientRep)
      .replace(/{{partner\.phone}}/g, clientPhone)
      .replace(/{{partner\.telefon}}/g, clientPhone)
      .replace(/{{partner\.email}}/g, clientEmail);

    // Înlocuire sigură a oricărui text de tip placeholder deja existent în șablon
    raw = raw
      .replace(/\[Selecta[țt]i Partenerul\]/gi, partnerName)
      .replace(/\[Select Customer\]/gi, partnerName);
  } else {
    raw = raw
      .replace(/{{partner\.name}}/g, isEn ? "[Select Customer]" : "[Selectați Partenerul]")
      .replace(/{{partner\.cui}}/g, "-")
      .replace(/{{partner\.regCom}}/g, "-")
      .replace(/{{partner\.j}}/g, "-")
      .replace(/{{partner\.rc}}/g, "-")
      .replace(/{{J_Client}}/g, "-")
      .replace(/{{partner\.city}}/g, "-")
      .replace(/{{partner\.address}}/g, "-")
      .replace(/{{partner\.iban}}/g, "-")
      .replace(/{{partner\.bank}}/g, "-")
      .replace(/{{partner\.subdomain}}/g, "client")
      .replace(/{{partner\.slug}}/g, "client")
      .replace(/{{partner\.delegat}}/g, clientRep)
      .replace(/{{partner\.reprezentant}}/g, clientRep)
      .replace(/{{partner\.contactName}}/g, clientRep)
      .replace(/{{partner\.phone}}/g, clientPhone)
      .replace(/{{partner\.telefon}}/g, clientPhone)
      .replace(/{{partner\.email}}/g, clientEmail);
  }

  // Formatare numere și parametri comerciali
  const currency = docCurrency || "EUR";
  const numBase = parseFloat(basePrice.replace(",", ".")) || 4.0;
  const numPromo = parseFloat(promoPrice.replace(",", ".")) || 3.5;
  const basePriceStr = numBase.toFixed(2).replace(".", ",");
  const promoPriceStr = numPromo.toFixed(2).replace(".", ",");
  const halfBaseStr = (numBase / 2).toFixed(2).replace(".", ",");
  const halfPromoStr = (numPromo / 2).toFixed(2).replace(".", ",");

  const totMonths = Number(totalDurationMonths) || 15;
  const pMonths = Number(promoMonths) || 3;
  const tMonths = Number(trialMonths) || 1;
  const renMonths = Number(autoRenewalMonths) || 12;
  const stdMonths = hasPromo ? Math.max(1, totMonths - pMonths) : totMonths;

  const isSignage = raw.includes("Smart Displays") || raw.includes("smr.onl") || raw.includes("DIGITAL SIGNAGE");

  // 1. Clauze Art. 3 pentru GetApp Smart QR
  // Versiunea Română (RO)
  let art3SmartQrRo = "";
  let idxQrRo = 1;
  if (hasTrial) {
    art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. Perioada de probă gratuită (Trial):</strong> Serviciul beneficiază de o perioadă pilot de testare operațională și instruire pe o durată de <strong>${tMonths} ${tMonths === 1 ? "lună" : "luni"}</strong> de la semnarea contractului, furnizată gratuit (0,00 ${currency}), fără facturare.</p>`;
    idxQrRo++;
  } else {
    art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. Începerea facturării:</strong> Facturarea începe direct de la semnarea contractului (<strong>${docDate}</strong>), fără perioadă de probă gratuită.</p>`;
    idxQrRo++;
  }
  if (hasPromo) {
    art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. Primele ${pMonths} luni cu preț redus:</strong> Tariful lunar este redus promoțional la <strong>€${promoPriceStr} + TVA / angajat activ / lună</strong>.</p>`;
    idxQrRo++;
    art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. Următoarele ${stdMonths} luni cu preț standard:</strong> Tariful contractual standard este de <strong>€${basePriceStr} + TVA / angajat activ / lună</strong>.</p>`;
    idxQrRo++;
  } else {
    art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. Tariful contractual standard:</strong> Tariful lunar este de <strong>€${basePriceStr} + TVA / angajat activ / lună</strong> pe întreaga durată.</p>`;
    idxQrRo++;
  }
  art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. Regula celor 15 zile la calculul fluctuațiilor:</strong></p>
<ul style="margin: 4px 0 8px 22px; line-height: 1.6;">
  <li><strong>Angajat stabil sau migrat (&ge; 15 zile active):</strong> se contorizează o singură dată și se facturează 100% (${hasPromo ? `€${promoPriceStr} + TVA (primele ${pMonths} luni), respectiv €${basePriceStr} + TVA` : `€${basePriceStr} + TVA`});</li>
  <li><strong>Angajat nou-venit sau plecat (&lt; 15 zile active):</strong> se facturează pro-rata la 50% (${hasPromo ? `€${halfPromoStr} + TVA (primele ${pMonths} luni), respectiv €${halfBaseStr} + TVA` : `€${halfBaseStr} + TVA`});</li>
  <li><strong>Angajați inactivi / suspendați:</strong> nu se facturează (0,00 ${currency}).</li>
</ul>`;
  idxQrRo++;
  art3SmartQrRo += `<p style="margin: 6px 0;"><strong>3.${idxQrRo}. TVA și Monedă:</strong> TVA 21%. Facturare lunară în RON la cursul BNR din data facturii. Termen de plată: <strong>${paymentTermDays} zile calendaristice</strong>.</p>`;

  // Versiunea Engleză (EN)
  let art3SmartQrEn = "";
  let idxQrEn = 1;
  if (hasTrial) {
    art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. Free Pilot Trial Period:</strong> The service includes an operational pilot testing and training period of <strong>${tMonths} ${tMonths === 1 ? "month" : "months"}</strong> from agreement signing, provided free of charge (0.00 ${currency}), without invoicing.</p>`;
    idxQrEn++;
  } else {
    art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. Invoicing Commencement:</strong> Invoicing starts directly on the date of contract signing (<strong>${docDate}</strong>), without a free trial period.</p>`;
    idxQrEn++;
  }
  if (hasPromo) {
    art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. First ${pMonths} months at promotional rate:</strong> Monthly tariff is reduced to <strong>€${promoPriceStr} + VAT / active employee / month</strong>.</p>`;
    idxQrEn++;
    art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. Subsequent ${stdMonths} months at standard rate:</strong> Standard rate is <strong>€${basePriceStr} + VAT / active employee / month</strong>.</p>`;
    idxQrEn++;
  } else {
    art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. Standard Contractual Rate:</strong> Standard monthly rate is <strong>€${basePriceStr} + VAT / active employee / month</strong> throughout the term.</p>`;
    idxQrEn++;
  }
  art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. The 15-day calculation rule for employee fluctuations:</strong></p>
<ul style="margin: 4px 0 8px 22px; line-height: 1.6;">
  <li><strong>Stable or transferred employee (&ge; 15 active days):</strong> counted once per company and billed at 100% full rate (${hasPromo ? `€${promoPriceStr} + VAT in first ${pMonths} months, respectively €${basePriceStr} + VAT` : `€${basePriceStr} + VAT`});</li>
  <li><strong>New hire or departed employee (&lt; 15 active days):</strong> billed pro-rata at 50% rate (${hasPromo ? `€${halfPromoStr} + VAT in first ${pMonths} months, respectively €${halfBaseStr} + VAT` : `€${halfBaseStr} + VAT`});</li>
  <li><strong>Inactive / suspended employees:</strong> not billed (0.00 ${currency}).</li>
</ul>`;
  idxQrEn++;
  art3SmartQrEn += `<p style="margin: 6px 0;"><strong>3.${idxQrEn}. VAT and Currency:</strong> 21% VAT applies. Invoiced monthly in RON at the official BNR rate on invoice date. Payment term: <strong>${paymentTermDays} calendar days</strong>.</p>`;

  let finalArt3SmartQr = "";
  if (isEn) {
    finalArt3SmartQr = art3SmartQrEn;
  } else if (isBilingual) {
    finalArt3SmartQr = `
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">
          ${art3SmartQrRo}
        </td>
        <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">
          ${art3SmartQrEn}
        </td>
      </tr>
    </table>`;
  } else {
    finalArt3SmartQr = art3SmartQrRo;
  }

  // 2. Clauze Art. 5 Durată pentru Smart QR
  const art5SmartQrRo = `
  <p style="margin: 6px 0;"><strong>5.1. Durata inițială:</strong> Prezentul contract se încheie pe o perioadă de ${totMonths} luni de la începerea facturării${hasPromo ? ` (${pMonths} luni la €${promoPriceStr} + TVA și ${stdMonths} luni la €${basePriceStr} + TVA)` : ` la tariful de €${basePriceStr} + TVA`}.</p>
  <p style="margin: 6px 0;"><strong>5.2. Prelungire automată cu ${renMonths} luni:</strong> În lipsa unei notificări scrise cu cel puțin 30 de zile înainte de expirare, contractul se prelungește automat cu perioade succesive de câte ${renMonths} luni.</p>
  <p style="margin: 6px 0;"><strong>5.3. Denunțare:</strong> Preaviz de 30 de zile calendaristice${hasPromo ? `, cu respectarea perioadei minime a primelor ${pMonths} luni` : ""}.</p>`;

  const art5SmartQrEn = `
  <p style="margin: 6px 0;"><strong>5.1. Initial Term:</strong> This agreement is concluded for a firm period of ${totMonths} months from the start of invoicing${hasPromo ? ` (${pMonths} months at €${promoPriceStr} + VAT and ${stdMonths} months at €${basePriceStr} + VAT)` : ` at the standard rate of €${basePriceStr} + VAT`}.</p>
  <p style="margin: 6px 0;"><strong>5.2. Automatic Renewal for ${renMonths} Months:</strong> Unless written notice of non-renewal is provided at least 30 days prior to expiration, the contract automatically renews for successive periods of ${renMonths} months.</p>
  <p style="margin: 6px 0;"><strong>5.3. Termination:</strong> Written notice of 30 calendar days${hasPromo ? `, respecting the initial minimum period of the first ${pMonths} months` : ""}.</p>`;

  let finalArt5SmartQr = "";
  if (isEn) {
    finalArt5SmartQr = art5SmartQrEn;
  } else if (isBilingual) {
    finalArt5SmartQr = `
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">
          ${art5SmartQrRo}
        </td>
        <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">
          ${art5SmartQrEn}
        </td>
      </tr>
    </table>`;
  } else {
    finalArt5SmartQr = art5SmartQrRo;
  }

  // 3. Tabele Anexa 1 (Smart QR)
  let pricingRows = "";
  let sNum = 1;
  if (hasTrial) {
    pricingRows += `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? `Stage ${sNum}` : isBilingual ? `Etapa / Stage ${sNum}` : `Etapa ${sNum}`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${isEn ? `Initial pilot test (${tMonths} ${tMonths === 1 ? "month" : "months"})` : isBilingual ? `Test operațional (${tMonths} luni / months)` : `Perioadă inițială de test (${tMonths} ${tMonths === 1 ? "lună" : "luni"})`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;"><span style="color: #16a34a; font-weight: bold;">${isEn ? "FREE TRIAL" : isBilingual ? "PROBĂ GRATUITĂ / TRIAL" : "PROBĂ GRATUITĂ"}</span></td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold;">0,00 ${currency}</td>
      </tr>`;
    sNum++;
  }
  if (hasPromo) {
    pricingRows += `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? `Stage ${sNum}` : isBilingual ? `Etapa / Stage ${sNum}` : `Etapa ${sNum}`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${isEn ? `First ${pMonths} months (Discounted Rate)` : isBilingual ? `Primele ${pMonths} luni (Promo / First ${pMonths}m)` : `Primele ${pMonths} luni (Preț Redus)`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;"><span style="color: #2563eb; font-weight: bold;">${isEn ? "PROMO TARIFF" : isBilingual ? "PROMOȚIONAL / PROMO" : "TARIF PROMOȚIONAL"}</span></td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold;">€${promoPriceStr} + TVA 21% / angajat</td>
      </tr>`;
    sNum++;
    pricingRows += `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? `Stage ${sNum}` : isBilingual ? `Etapa / Stage ${sNum}` : `Etapa ${sNum}`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${isEn ? `Following ${stdMonths} months (Standard Rate)` : isBilingual ? `Următoarele ${stdMonths} luni (Standard / ${stdMonths}m)` : `Următoarele ${stdMonths} luni (Preț Standard)`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;"><span style="color: #475569; font-weight: bold;">${isEn ? "STANDARD TARIFF" : isBilingual ? "STANDARD" : "TARIF STANDARD"}</span></td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold;">€${basePriceStr} + TVA 21% / angajat</td>
      </tr>`;
  } else {
    pricingRows += `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? `Stage ${sNum}` : isBilingual ? `Etapa / Stage ${sNum}` : `Etapa ${sNum}`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${isEn ? `Contractual term (${totMonths} months)` : isBilingual ? `Durată contractuală (${totMonths} luni/months)` : `Durata contractuală (${totMonths} luni)`}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;"><span style="color: #475569; font-weight: bold;">${isEn ? "STANDARD TARIFF" : isBilingual ? "STANDARD" : "TARIF STANDARD"}</span></td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold;">€${basePriceStr} + TVA 21% / angajat</td>
      </tr>`;
  }

  const pricingTableHtml = `
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px; border: 1px solid #cbd5e1;">
    <thead>
      <tr style="background-color: #f1f5f9; color: #1e293b;">
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Stage" : isBilingual ? "Etapă / Stage" : "Etapă"}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Calendar Period" : isBilingual ? "Perioadă / Period" : "Perioadă Calendaristică"}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Rate Status" : isBilingual ? "Statut / Status" : "Statut Tarifar"}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">${isEn ? "Applicable Tariff" : isBilingual ? "Tarif / Rate" : "Tarif Aplicabil"}</th>
      </tr>
    </thead>
    <tbody>
      ${pricingRows}
    </tbody>
  </table>`;

  const prorataTableHtml = `
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px; border: 1px solid #cbd5e1;">
    <thead>
      <tr style="background-color: #f1f5f9; color: #1e293b;">
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Employee Status" : isBilingual ? "Statut Salariat / Status" : "Statut Salariat în Lună"}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Active Days Condition" : isBilingual ? "Zile Active / Active Days" : "Condiție Zile Active"}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Invoiced Quota" : isBilingual ? "Cotă / Quota" : "Cotă Facturată"}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">${isEn ? "Applied Tariff" : isBilingual ? "Tarif / Rate" : "Tarif Aplicat (EUR + TVA)"}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? "Stable or transferred employee" : isBilingual ? "Salariat stabil / migrat (Stable employee)" : "Angajat stabil sau migrat între locații"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">&ge; 15 ${isEn ? "active days" : "zile active"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">100%</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">${hasPromo ? `€${promoPriceStr} (promo) / €${basePriceStr} (standard)` : `€${basePriceStr} (standard)`}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? "New hire or departed employee" : isBilingual ? "Angajat nou/plecat (New hire/departed)" : "Angajat nou-apărut sau plecat în lună"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">&lt; 15 ${isEn ? "active days" : "zile active"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">50%</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">${hasPromo ? `€${halfPromoStr} (promo) / €${halfBaseStr} (standard)` : `€${halfBaseStr} (standard)`}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${isEn ? "Suspended / Unpaid leave" : isBilingual ? "Suspendat / concediu fără plată" : "Angajat suspendat / concediu fără plată"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">0 ${isEn ? "active days" : "zile active"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">0%</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">0,00 ${currency}</td>
      </tr>
    </tbody>
  </table>`;

  // 4. Clauze Digital Signage
  const art3SigRo = hasTrial
    ? `<p style="margin: 6px 0;"><strong>3.1. Probă gratuită:</strong> Pe o durată de <strong>${tMonths} ${tMonths === 1 ? "lună" : "luni"}</strong>, utilizarea platformei și a ecranelor este 100% GRATUITĂ (0 ${currency}).</p>
       <p style="margin: 6px 0;"><strong>3.2. Tarif lunar:</strong> La finalizarea probei, serviciul se facturează lunar la tariful de <strong>€${basePriceStr} + TVA / ecran activ / lună</strong>.</p>`
    : `<p style="margin: 6px 0;"><strong>3.1. Tarif lunar:</strong> Facturarea începe direct de la semnarea contractului la tariful de <strong>€${basePriceStr} + TVA / ecran activ / lună</strong>.</p>`;

  const art3SigEn = hasTrial
    ? `<p style="margin: 6px 0;"><strong>3.1. Free Trial:</strong> For a duration of <strong>${tMonths} ${tMonths === 1 ? "month" : "months"}</strong>, platform and screen usage is 100% FREE (0 ${currency}).</p>
       <p style="margin: 6px 0;"><strong>3.2. Monthly Tariff:</strong> Upon trial completion, billing is <strong>€${basePriceStr} + VAT / active screen / month</strong> based on active displays.</p>`
    : `<p style="margin: 6px 0;"><strong>3.1. Monthly Tariff:</strong> Invoicing starts directly upon signing at the contractual rate of <strong>€${basePriceStr} + VAT / active screen / month</strong>.</p>`;

  let finalArt3Signage = "";
  if (isEn) {
    finalArt3Signage = art3SigEn;
  } else if (isBilingual) {
    finalArt3Signage = `
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">${art3SigRo}</td>
        <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">${art3SigEn}</td>
      </tr>
    </table>`;
  } else {
    finalArt3Signage = art3SigRo;
  }

  const art4SigRo = `
  <p style="margin: 6px 0;"><strong>4.1. Durată:</strong> Prezentul contract se încheie pe o durată fermă de ${totMonths} luni.</p>
  <p style="margin: 6px 0;"><strong>4.2. Prelungire automată:</strong> Se prelungește automat cu câte ${renMonths} luni în lipsa unei notificări de 30 de zile.</p>`;

  const art4SigEn = `
  <p style="margin: 6px 0;"><strong>4.1. Term:</strong> This agreement is concluded for a firm term of ${totMonths} months.</p>
  <p style="margin: 6px 0;"><strong>4.2. Automatic Renewal:</strong> Automatically renewed for successive periods of ${renMonths} months unless 30-day notice is given.</p>`;

  let finalArt4Signage = "";
  if (isEn) {
    finalArt4Signage = art4SigEn;
  } else if (isBilingual) {
    finalArt4Signage = `
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">${art4SigRo}</td>
        <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">${art4SigEn}</td>
      </tr>
    </table>`;
  } else {
    finalArt4Signage = art4SigRo;
  }

  // Formatare data in format romanesc DD.MM.YYYY pentru afisare in contractele Wood Glass daca este YYYY-MM-DD
  const formatRoDate = (dStr: string) => {
    if (!dStr) return dStr;
    const m = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : dStr;
  };

  const rawOfferNum = offerNumber?.trim() || docNumber.replace(/\D/g, "") || "4089";
  const resolvedOfferNumber = /^OFR\b/i.test(rawOfferNum) ? rawOfferNum : `OFR ${rawOfferNum}`;
  const resolvedOfferDate = formatRoDate(offerDate?.trim() || docDate);
  const resolvedWarrantyYears =
    warrantyYears?.trim() ||
    (warrantyMonths ? String(Math.max(1, Math.round(Number(warrantyMonths) / 12))) : "3");

  // Clauze dinamice pentru Contract Tip Wood Glass (Modelele Oficiale 393 Intern PF/PJ, 324 Extern PF, 392/364 Extern PJ)
  const wgCurrencyLabel =
    docCurrency?.toUpperCase() === "RON" || docCurrency?.toUpperCase() === "LEI" ? "LEI" : "EUR";

  const wgSupplierBankClause =
    wgCurrencyLabel === "EUR"
      ? `cont EURO: ${activeTenantIbanEur}`
      : `cont RON: ${activeTenantIban}`;

  const bName = partnerName || "[Selectați Beneficiarul]";
  const bAddress =
    partnerAddress && partnerAddress !== "-"
      ? partnerAddress
      : partnerCity && partnerCity !== "-"
      ? partnerCity
      : "________________________";
  const bCity =
    partnerCity &&
    partnerCity !== "-" &&
    !bAddress.toLowerCase().includes(partnerCity.toLowerCase())
      ? `, ${partnerCity}`
      : "";
  const bCui = partnerCui && partnerCui !== "-" ? partnerCui : "____________";
  const bRegCom = partnerRegCom && partnerRegCom !== "-" ? partnerRegCom : "";
  const bRep =
    partnerContactName?.trim() ||
    (partner ? partner.contactPerson || partner.delegat || "" : "");

  const cleanOfferNumOnly = rawOfferNum.replace(/^OFR\s*/i, "");
  const effectiveTranches = paymentTranches || (wgMarketType === "intern" ? "50-40-10" : "50-50");

  let wgContractBody = "";

  if (wgMarketType === "intern") {
    // MODELUL OFICIAL 393 — INTERN (Persoană Fizică sau Persoană Juridică, 27 clauze, PV predare-primire, inclusiv TVA)
    const internParty2 =
      wgBeneficiaryType === "pf"
        ? `2. <strong>${bName}</strong>, cu domiciliu în ${bAddress}${bCity}, identificat(ă) cu ${
            bCui !== "____________" ? (bCui.toUpperCase().includes("CI") ? bCui : `CI / CNP ${bCui}`) : "CI seria ____, Nr. ________"
          }, în calitate de Beneficiar, au convenit să încheie prezentul contract de vânzare-cumpărare cu respectarea următoarelor clauze:`
        : `2. <strong>${bName}</strong>, cu sediul în ${bAddress}${bCity},${
            bRegCom ? ` înregistrată la Oficiul Comerțului sub nr. ${bRegCom},` : ""
          } CUI ${bCui}, reprezentată prin ${
            bRep || "dl./dna. ________________"
          }, în calitate de Beneficiar, au convenit să încheie prezentul contract de vânzare-cumpărare cu respectarea următoarelor clauze:`;

    const internVerb1 =
      wgTransportIncluded === "da"
        ? "Furnizorul se obligă să producă și să transporte"
        : "Furnizorul se obligă să producă";

    const internClause2 =
      wgTransportIncluded === "da"
        ? "Mărfurile care fac obiectul prezentului contract vor fi executate și livrate la adresa stabilită de Beneficiar."
        : "Mărfurile care fac obiectul prezentului contract vor fi executate și predate la sediul Furnizorului din Brașov, Str. Zizinului nr. 625, transportul fiind în sarcina Beneficiarului.";

    const internClause8 =
      wgCurrencyLabel === "EUR"
        ? `Valoarea lucrării ce face obiectul prezentului contract este de <strong>${docValue} EUR</strong>, inclusiv TVA. Valoarea contractului este exprimată în EURO, iar plata se va efectua în lei, la cursul BNR din ziua facturării.`
        : `Valoarea lucrării ce face obiectul prezentului contract este de <strong>${docValue} LEI</strong>, inclusiv TVA.`;

    const internClause10 =
      effectiveTranches === "50-50"
        ? `10. Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita la data semnării prezentului contract;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita cu cinci zile înainte de livrare.`
        : `10. Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita la data semnării prezentului contract;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-40% se va achita cu cinci zile înainte de livrare;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-10% se va achita la recepția lucrării.`;

    const internClause11 =
      wgCurrencyLabel === "EUR"
        ? "11. Prețul se va achita în lei, la cursul EURO afișat de către BNR în ziua facturării, prin ordin de plată vizat de bancă."
        : "11. Prețul se va achita în lei, prin ordin de plată vizat de bancă.";

    const internSigBeneficiar =
      wgBeneficiaryType === "pf"
        ? `BENEFICIAR<br/>${bName}`
        : `BENEFICIAR<br/>${bName}<br/>Reprezentant: ${bRep || "________________"}`;

    wgContractBody = `
  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    PĂRȚILE CONTRACTANTE
  </h3>
  <p style="margin: 6px 0; text-align: justify;">
    1. S.C. WOOD GLASS S.R.L., cu sediul în Brașov, Str. Zizinului nr. 625, înregistrată la Oficiul Comerțului sub nr. J2011000729084, CUI RO28396216, cont RON: ${activeTenantIban}, cont EURO: ${activeTenantIbanEur}, deschis la ING Brașov, reprezentată prin dl. Șaran Vitalie, în calitate de Furnizor,<br/>și
  </p>
  <p style="margin: 6px 0 16px 0; text-align: justify;">
    ${internParty2}
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    A. OBIECTUL CONTRACTULUI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    1. ${internVerb1}, iar Beneficiarul acceptă să cumpere <strong>${woodEssence}</strong>, conform Ofertei de preț nr. ${cleanOfferNumOnly}/${resolvedOfferDate} care face parte integrantă din prezentul contract.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    2. ${internClause2}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    3. Specificațiile tehnice detaliate (dimensiuni, finisaje, accesorii și alte detalii relevante) sunt incluse în anexele contractului.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    B. GARANȚII ȘI RISCURI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    4. Furnizorul garantează bunurile vândute împotriva evicțiunii și contra viciilor ascunse.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    5. La recepția lucrării și achitarea integrală a prețului, Beneficiarul va primi certificatul de garanție corespunzător lucrării prestate de Furnizor. Garanția oferită este de ${resolvedWarrantyYears} ani.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    6. Riscurile asupra mărfii trec de la Furnizor la Beneficiar în momentul recepției acesteia. Pe durata transportului, răspunderea pentru marfă aparține transportatorului până la recepția de către Beneficiar.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    7. Proprietatea asupra mărfii trece de la Furnizor la Beneficiar în momentul achitării integrale a produselor livrate.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    C. VALOAREA CONTRACTULUI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    8. ${internClause8}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    9. Pentru modificări ulterioare sau pentru lucrări suplimentare, diferite de cele stabilite prin prezentul contract, se vor întocmi documente separate, care vor modifica valoarea contractului, cu acordul ambelor părți.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    D. MODALITĂȚI DE PLATĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;" data-clause="woodglass-payment-tranches">
    ${internClause10}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    ${internClause11}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    12. Plata se va efectua în contul Furnizorului ${activeTenantIban} deschis la ING Brașov.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    E. TERMEN DE LIVRARE
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    13. Furnizorul se obligă să producă mărfurile ce fac obiectul prezentului contract, în termen de ${deliveryDays} zile calendaristice de la încasarea avansului de 50%.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    F. RECEPȚIA LUCRĂRILOR
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    14. Recepția lucrărilor se va efectua la predarea mărfurilor, pe bază de proces-verbal semnat de ambele părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    15. Dacă Beneficiarul nu se prezintă la recepție din motive imputabile acestuia și după notificarea transmisă potrivit prezentului contract, recepția se consideră a fi efectuată, iar în acest caz Beneficiarul este de acord cu lucrările efectuate și calitatea acestora.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    16. Notificarea se va transmite prin e-mail sau scrisoare cu confirmare de primire.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    G. RĂSPUNDEREA CONTRACTUALĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    17. Niciuna dintre părți nu poate modifica unilateral prezentul contract. Modificarea poate interveni numai prin acordul de voință, exprimat în scris, al ambelor părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    18. Dacă Beneficiarul întârzie plata produselor, va plăti penalități de 0,1% din suma datorată, pentru fiecare zi de întârziere.<br/>
    Dacă Furnizorul întârzie livrarea produselor față de termenul contractual, va plăti penalități de 0,1% din valoarea produselor nelivrate, pentru fiecare zi de întârziere, calculată de la data scadentă.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    19. În cazul nerespectării clauzelor contractuale de către una dintre părți, cealaltă parte poate rezoluționa unilateral contractul prin transmiterea unei notificări scrise.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    20. Contractul se consideră încheiat prin acordul scris al părților.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    21. Beneficiarul este de drept în întârziere la data la care trebuia efectuată plata, fără a mai fi necesară notificarea prevăzută de art. 1522 și art. 1523 Cod civil.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    H. FORȚA MAJORĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    22. Forța majoră, așa cum este definită de lege, exonerează de răspundere partea care o invocă, în condițiile legii, cu condiția notificării scrise, în termen de 3 zile de la apariția cazului respectiv. Partea interesată este obligată să producă dovada cu certificat eliberat de autoritatea competentă.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    I. CLAUZE FINALE. LITIGII
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    23. Furnizorul își rezervă dreptul de a sista unilateral livrările în cazul în care Beneficiarul întârzie plata față de termenul convenit.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    24. Rezilierea prezentului contract nu va avea niciun efect asupra obligațiilor deja scadente între părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    25. În cazul în care părțile își încalcă obligațiile, neexercitarea de către partea prejudiciată a dreptului de a cere executarea întocmai sau prin echivalent bănesc a obligației nu echivalează cu renunțarea la acest drept.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    26. Părțile declară că au studiat toate clauzele și au acceptat necondiționat drepturile și obligațiile conferite de prezentul contract.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    27. Eventualele litigii care s-ar putea ivi în legătură cu interpretarea și derularea prezentului contract vor fi soluționate pe cale amiabilă. Dacă acest lucru nu este posibil, litigiile vor fi soluționate de instanțele de judecată competente de la sediul Furnizorului.
  </p>

  <p style="text-align: center; margin: 32px 0 10px 0;">Semnătura și ștampila</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; border: 1px solid #334155;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #334155;">
        FURNIZOR<br/>
        S.C. WOOD GLASS S.R.L.<br/>
        Reprezentant: ȘARAN VITALIE
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #334155;">
        ${internSigBeneficiar}
      </td>
    </tr>
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 12px; border: 1px solid #334155;">
        Semnătură<br/><br/>
        ______________
      </td>
      <td style="width: 50%; vertical-align: top; padding: 12px; border: 1px solid #334155;">
        Semnătură<br/><br/>
        ______________
      </td>
    </tr>
  </table>`;
  } else if (wgBeneficiaryType === "pf") {
    // MODELUL OFICIAL 324 — EXTERN PERSOANĂ FIZICĂ (ROXANA LESOVICI, CMR, cu TVA adăugat conform cerinței)
    const extPfVerb1 =
      wgTransportIncluded === "da"
        ? "Furnizorul se obligă să producă și să transporte"
        : "Furnizorul se obligă să producă";

    const extPfClause2 =
      wgTransportIncluded === "da"
        ? "Mărfurile care fac obiectul prezentului contract vor fi executate și livrate la adresa stabilită de Beneficiar."
        : "Mărfurile care fac obiectul prezentului contract vor fi executate și predate la sediul Furnizorului din Brașov, Str. Zizinului nr. 625, transportul fiind în sarcina Beneficiarului.";

    const extPfClause10 =
      effectiveTranches === "50-40-10"
        ? `10. Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita la data semnării prezentului contract;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-40% se va achita cu cinci zile înainte de livrare;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-10% se va achita la recepția lucrării.`
        : `10. Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita la data semnării prezentului contract;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita cu cinci zile înainte de livrare.`;

    wgContractBody = `
  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    PĂRȚILE CONTRACTANTE
  </h3>
  <p style="margin: 6px 0; text-align: justify;">
    1. S.C. WOOD GLASS S.R.L., cu sediul în Brașov, Str. Zizinului nr. 625, înregistrată la Oficiul Comerțului sub nr. J2011000729084, CUI RO28396216, ${wgSupplierBankClause}, deschis la ING Brașov, reprezentată prin dl. Șaran Vitalie, în calitate de Furnizor,<br/>și
  </p>
  <p style="margin: 6px 0 16px 0; text-align: justify;">
    2. <strong>${bName}</strong>, cu domiciliul în ${bAddress}${bCity}, în calitate de Beneficiar, au convenit să încheie prezentul contract de vânzare-cumpărare cu respectarea următoarelor clauze:
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    A. OBIECTUL CONTRACTULUI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    1. ${extPfVerb1}, Beneficiarul acceptă să cumpere <strong>${woodEssence}</strong>, conform Ofertei de preț ${resolvedOfferNumber}/${resolvedOfferDate}, care face parte integrantă din prezentul contract.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    2. ${extPfClause2}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    3. Specificațiile tehnice detaliate (dimensiuni, finisaje, accesorii, caracteristici de montaj și alte detalii relevante) sunt incluse în anexele contractului.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    B. GARANȚII ȘI RISCURI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    4. Furnizorul garantează bunurile vândute împotriva evicțiunii și contra viciilor ascunse.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    5. La recepția lucrării și achitarea integrală a prețului, Beneficiarul va primi certificatul de garanție corespunzător lucrării prestate de Furnizor. Garanția oferită este de ${resolvedWarrantyYears} ani.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    6. Riscurile asupra mărfii trec de la Furnizor la Beneficiar în momentul recepției acesteia. Pe durata transportului, riscul este preluat de transportator.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    7. Proprietatea asupra mărfii trece de la Furnizor la Beneficiar în momentul achitării integrale a produselor livrate.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    C. VALOAREA CONTRACTULUI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    8. Valoarea lucrării ce face obiectul prezentului contract este de <strong>${docValue} ${wgCurrencyLabel === "EUR" ? "Euro" : "LEI"}</strong>, inclusiv TVA.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    9. Pentru modificări ulterioare sau pentru lucrări suplimentare, diferite de cele stabilite prin prezentul contract, se vor întocmi documente separate, care vor modifica valoarea contractului, cu acordul ambelor părți.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    D. MODALITĂȚI DE PLATĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;" data-clause="woodglass-payment-tranches">
    ${extPfClause10}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    11. Plata se va efectua în ${wgCurrencyLabel === "EUR" ? "EURO" : "LEI"} în contul Furnizorului ${
      wgCurrencyLabel === "EUR" ? activeTenantIbanEur : activeTenantIban
    } deschis la ING Brașov.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    E. TERMEN DE LIVRARE
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    12. Furnizorul se obligă să producă mărfurile ce fac obiectul prezentului contract, în termen de ${deliveryDays} de zile de la plata avansului.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    F. RECEPȚIA LUCRĂRILOR
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    13. Recepția mărfurilor se consideră efectuată în momentul livrării la adresa indicată de Beneficiar, conform documentului de transport (CMR) semnat de acesta sau de reprezentantul său.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    14. Eventualele neconformități vizibile (deteriorări, lipsuri cantitative etc.) trebuie menționate pe documentul de transport la momentul recepției și comunicate în scris Furnizorului, în termen de <strong>5 zile lucrătoare</strong> de la primirea mărfii.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    15. În lipsa unei astfel de notificări scrise, marfa se consideră acceptată definitiv de către Beneficiar, fără rezerve, iar recepția este considerată realizată integral.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    16. Pentru livrările internaționale, documentul CMR semnat de Beneficiar ține loc de proces-verbal de recepție.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    G. RĂSPUNDEREA CONTRACTUALĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    17. Niciuna dintre părți nu poate modifica unilateral prezentul contract. Modificarea poate interveni numai prin acordul de voință, exprimat în scris, al ambelor părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    18. Dacă Beneficiarul întârzie plata produselor, va plăti penalități de 0,1% din suma datorată, pentru fiecare zi de întârziere.<br/>
    Dacă Furnizorul întârzie livrarea sau montajul produselor față de termenul contractual, va plăti penalități de 0,1% din valoarea produselor nelivrate sau nemontate, pentru fiecare zi de întârziere, calculată de la data scadentă.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    19. În cazul nerespectării clauzelor contractuale de către una dintre părți, cealaltă parte poate rezoluționa unilateral contractul prin transmiterea unei notificări scrise.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    20. Contractul se consideră încheiat prin acordul scris al părților.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    21. Cumpărătorul este de drept în întârziere la data la care trebuia efectuată plata, fără a mai fi necesară notificarea prevăzută de art. 1522 și art. 1523 Cod civil.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    H. FORȚA MAJORĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    22. Forța majoră, așa cum este definită de lege, exonerează de răspundere partea care o invocă, în condițiile legii, cu condiția notificării scrise, în termen de 3 zile de la apariția cazului respectiv. Partea interesată este obligată să producă dovada cu certificat eliberat de autoritatea competentă.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    I. CLAUZE FINALE. LITIGII
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    23. Vânzătorul își rezervă dreptul de a sista unilateral livrările în cazul în care Cumpărătorul întârzie plata față de termenul convenit.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    24. Rezilierea prezentului contract nu va avea niciun efect asupra obligațiilor deja scadente între părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    25. Cumpărătorul este de drept pus în întârziere la data scadenței facturilor și se obligă să acorde preferință creanței Vânzătorului înaintea altor creditori, indiferent de situația juridică în care se va afla.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    26. Neexercitarea imediată de către una dintre părți a drepturilor conferite prin prezentul contract nu constituie renunțare la aceste drepturi, care pot fi exercitate ulterior în limitele legii.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    27. Părțile declară că au studiat toate clauzele și au acceptat necondiționat drepturile și obligațiile conferite de prezentul contract.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    28. Eventualele litigii care s-ar putea ivi în legătură cu interpretarea și derularea prezentului contract vor fi soluționate pe cale amiabilă. Dacă acest lucru nu este posibil, litigiile vor fi soluționate de instanțele competente din România, respectiv Tribunalul Brașov.<br/>
    Prezentul contract este guvernat de legea română, iar limba de referință pentru interpretarea sa este limba română.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    29. Reprezentantul legal al Cumpărătorului declară pe propria răspundere că durata pentru care s-a constituit persoana juridică pe care o reprezintă nu se va împlini în anul în curs sau în anul următor, aceasta nu este supusă reorganizării ori lichidării judiciare sau voluntare și nu este în curs de divizare.
  </p>

  <p style="text-align: center; margin: 32px 0 10px 0;">Semnătura și ștampila</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; border: 1px solid #334155;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #334155;">
        FURNIZOR<br/>
        S.C. WOOD GLASS S.R.L.<br/>
        Reprezentant: SARAN VITALIE
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #334155;">
        BENEFICIAR<br/>
        ${bName}<br/>
        Reprezentant: ${bRep}
      </td>
    </tr>
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 12px; border: 1px solid #334155;">
        Semnătură<br/><br/>
        ______________
      </td>
      <td style="width: 50%; vertical-align: top; padding: 12px; border: 1px solid #334155;">
        Semnătură<br/><br/>
        ______________
      </td>
    </tr>
  </table>`;
  } else {
    // MODELUL OFICIAL 392 BV DELVAC & 364 MDVIP — EXTERN PERSOANĂ JURIDICĂ (30 clauze, CMR, fără TVA / scutit de TVA)
    const extPjVerb1 =
      wgTransportIncluded === "da"
        ? "Furnizorul se obligă să producă și să transporte"
        : "Furnizorul se obligă să producă";

    const extPjDeliverySentence =
      wgTransportIncluded === "da"
        ? "Mărfurile care fac obiectul prezentului contract vor fi executate și livrate la adresa stabilită de Beneficiar."
        : "Mărfurile care fac obiectul prezentului contract vor fi executate și predate la sediul Furnizorului din Brașov, Str. Zizinului nr. 625, transportul fiind în sarcina Beneficiarului.";

    const extPjTransportPriceSentence =
      wgTransportIncluded === "da"
        ? "Prețul contractului include ambalajul și transportul produselor la adresa comunicată în scris de Beneficiar."
        : "Prețul contractului include ambalajul produselor, fără transport inclus.";

    const extPjClause10 =
      effectiveTranches === "50-40-10"
        ? `10. Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita la data semnării prezentului contract;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-40% se va achita cu cinci zile înainte de livrare;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-10% se va achita la recepția lucrării.`
        : `10. Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita la data semnării prezentului contract;<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;-50% se va achita cu cinci zile înainte de livrare.`;

    wgContractBody = `
  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    PĂRȚILE CONTRACTANTE
  </h3>
  <p style="margin: 6px 0; text-align: justify;">
    1. S.C. WOOD GLASS S.R.L., cu sediul în Brașov, Str. Zizinului nr. 625, înregistrată la Oficiul Comerțului sub nr. J2011000729084, CUI RO28396216, ${wgSupplierBankClause}, deschis la ING Brașov, reprezentată prin dl. Șaran Vitalie, în calitate de Furnizor,<br/>și
  </p>
  <p style="margin: 6px 0 16px 0; text-align: justify;">
    2. <strong>${bName}</strong>, cu sediul în ${bAddress}${bCity}, identificat(ă) prin VAT no. ${bCui}, reprezentată prin ${
      bRep || "dl./dna. ________________"
    }, în calitate de Beneficiar, au convenit să încheie prezentul contract de vânzare-cumpărare cu respectarea următoarelor clauze:
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    A. OBIECTUL CONTRACTULUI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    ${extPjVerb1}, iar Beneficiarul se obligă să cumpere <strong>${woodEssence}</strong>, conform Ofertei de preț nr. ${cleanOfferNumOnly}/${resolvedOfferDate}, care face parte integrantă din prezentul contract. ${extPjDeliverySentence}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    1. Specificațiile tehnice detaliate (dimensiuni, finisaje, accesorii, caracteristici de montaj și alte detalii relevante) sunt incluse în anexele contractului.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    2. Beneficiarul răspunde pentru exactitatea dimensiunilor, măsurătorilor, desenelor, schițelor și a tuturor informațiilor tehnice furnizate Furnizorului. Furnizorul nu răspunde pentru neconformitățile rezultate din date eronate, incomplete sau incorect comunicate de Beneficiar.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    B. GARANȚII ȘI RISCURI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    3. Furnizorul garantează bunurile vândute împotriva evicțiunii și contra viciilor ascunse.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    4. La recepția lucrării și achitarea integrală a prețului, Beneficiarul va primi certificatul de garanție corespunzător lucrării prestate de Furnizor. Garanția oferită este de ${resolvedWarrantyYears} ani.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    5. Riscurile asupra mărfii trec de la Furnizor la Beneficiar în momentul recepției acesteia. Pe durata transportului, riscul este preluat de transportator.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    6. Proprietatea asupra mărfii trece de la Furnizor la Beneficiar în momentul achitării integrale a produselor livrate.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    C. VALOAREA CONTRACTULUI
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    7. Valoarea lucrărilor ce fac obiectul prezentului contract este de <strong>${docValue} ${wgCurrencyLabel}</strong>. Operațiunea reprezintă o livrare intracomunitară de bunuri, scutită de TVA în condițiile legislației fiscale aplicabile. ${extPjTransportPriceSentence}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    8. Montajul nu este inclus în preț și nu face obiectul prezentului contract.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    9. Pentru modificări ulterioare sau pentru lucrări suplimentare, diferite de cele stabilite prin prezentul contract, se vor întocmi documente separate, care vor modifica valoarea contractului, cu acordul ambelor părți.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    D. MODALITĂȚI DE PLATĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;" data-clause="woodglass-payment-tranches">
    ${extPjClause10}
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    11. Livrarea produselor este condiționată de achitarea integrală a prețului contractului.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    12. În lipsa achitării integrale, Furnizorul are dreptul de a suspenda livrarea fără a fi considerat în întârziere și fără aplicarea de penalități în sarcina sa.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    13. Plata se va efectua în ${wgCurrencyLabel === "EUR" ? "EURO" : "LEI"} în contul Furnizorului ${
      wgCurrencyLabel === "EUR" ? activeTenantIbanEur : activeTenantIban
    } deschis la ING Brașov.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    E. TERMEN DE LIVRARE
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    14. Furnizorul se obligă să producă mărfurile ce fac obiectul prezentului contract, în termen de ${deliveryDays} de zile calendaristice de la plata avansului. Termenul de livrare începe să curgă de la data încasării avansului și a confirmării tuturor detaliilor tehnice necesare execuției.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    F. RECEPȚIA LUCRĂRILOR
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    15. Recepția mărfurilor se consideră efectuată în momentul livrării la adresa indicată de Beneficiar, conform documentului de transport (CMR) semnat de acesta sau de reprezentantul său.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    16. Eventualele neconformități vizibile (deteriorări, lipsuri cantitative etc.) trebuie menționate pe documentul de transport la momentul recepției și comunicate în scris Furnizorului, în termen de <strong>5 zile lucrătoare</strong> de la primirea mărfii.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    17. În lipsa unei astfel de notificări scrise, marfa se consideră acceptată definitiv de către Beneficiar, fără rezerve, iar recepția este considerată realizată integral.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    18. Pentru livrările internaționale, documentul CMR semnat de Beneficiar ține loc de proces-verbal de recepție.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    G. RĂSPUNDEREA CONTRACTUALĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    19. Niciuna dintre părți nu poate modifica unilateral prezentul contract. Modificarea poate interveni numai prin acordul de voință, exprimat în scris, al ambelor părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    20. Dacă Beneficiarul întârzie plata produselor, va plăti penalități de 0,1% din suma datorată, pentru fiecare zi de întârziere.<br/>
    Dacă Furnizorul întârzie livrarea produselor față de termenul contractual, va plăti penalități de 0,1% din valoarea produselor nelivrate, pentru fiecare zi de întârziere, calculată de la data scadentă. Penalitățile datorate de Furnizor pentru întârzierea livrării nu pot depăși 5% din valoarea produselor nelivrate.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    21. În cazul nerespectării clauzelor contractuale de către una dintre părți, cealaltă parte poate rezoluționa unilateral contractul prin transmiterea unei notificări scrise.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    22. Contractul se consideră încheiat prin acordul scris al părților.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    23. Cumpărătorul este de drept în întârziere la data la care trebuia efectuată plata, fără a mai fi necesară notificarea prevăzută de art. 1522 și art. 1523 Cod civil.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    H. FORȚA MAJORĂ
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    24. Forța majoră, așa cum este definită de lege, exonerează de răspundere partea care o invocă, în condițiile legii, cu condiția notificării scrise, în termen de 3 zile de la apariția cazului respectiv. Partea interesată este obligată să producă dovada cu certificat eliberat de autoritatea competentă.
  </p>

  <h3 style="color: #2563eb; font-size: 12.5px; margin: 18px 0 8px 0; text-transform: uppercase; font-weight: bold;">
    I. CLAUZE FINALE. LITIGII
  </h3>
  <p style="margin: 5px 0; text-align: justify;">
    25. Vânzătorul își rezervă dreptul de a sista unilateral livrările în cazul în care Cumpărătorul întârzie plata față de termenul convenit.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    26. Rezilierea prezentului contract nu va avea niciun efect asupra obligațiilor deja scadente între părți.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    27. Neexercitarea imediată de către una dintre părți a drepturilor conferite prin prezentul contract nu constituie renunțare la aceste drepturi, care pot fi exercitate ulterior în limitele legii.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    28. Părțile declară că au studiat toate clauzele și au acceptat necondiționat drepturile și obligațiile conferite de prezentul contract.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    29. Eventualele litigii care s-ar putea ivi în legătură cu interpretarea și derularea prezentului contract vor fi soluționate pe cale amiabilă. Dacă acest lucru nu este posibil, litigiile vor fi soluționate de instanțele competente din România, respectiv Tribunalul Brașov.<br/>
    Prezentul contract este guvernat de legea română, iar limba de referință pentru interpretarea sa este limba română.
  </p>
  <p style="margin: 5px 0; text-align: justify;">
    30. Reprezentantul legal al Cumpărătorului declară pe propria răspundere că durata pentru care s-a constituit persoana juridică pe care o reprezintă nu se va împlini în anul în curs sau în anul următor, aceasta nu este supusă reorganizării ori lichidării judiciare sau voluntare și nu este în curs de divizare.
  </p>

  <p style="text-align: center; margin: 32px 0 10px 0;">Semnătura și ștampila</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; border: 1px solid #334155;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #334155;">
        FURNIZOR<br/>
        SC WOOD GLASS SRL<br/>
        Reprezentant: SARAN VITALIE
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #334155;">
        BENEFICIAR<br/>
        ${bName}<br/>
        Reprezentant: ${bRep || "________________"}
      </td>
    </tr>
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 12px; border: 1px solid #334155;">
        Semnătură<br/><br/>
        ______________
      </td>
      <td style="width: 50%; vertical-align: top; padding: 12px; border: 1px solid #334155;">
        Semnătură<br/><br/>
        ______________
      </td>
    </tr>
  </table>`;
  }

  raw = raw.replace(/{{wg\.contractBody}}/g, wgContractBody);

  // Inlocuire variabile comerciale contract
  raw = raw
    .replace(/{{contract\.number}}/g, docNumber)
    .replace(/{{contract\.date}}/g, isWoodGlass ? formatRoDate(docDate) : docDate)
    .replace(/{{contract\.value}}/g, docValue)
    .replace(/{{contract\.currency}}/g, isWoodGlass ? wgCurrencyLabel : docCurrency)
    .replace(/{{contract\.paymentTerm}}/g, paymentTermDays)
    .replace(/{{contract\.deliveryDays}}/g, deliveryDays)
    .replace(/{{contract\.warrantyMonths}}/g, warrantyMonths)
    .replace(/{{contract\.warrantyYears}}/g, resolvedWarrantyYears)
    .replace(/{{contract\.woodEssence}}/g, woodEssence || "Tâmplărie lemn stratificat, esență meranti, 68 mm")
    .replace(/{{contract\.glassWarrantyMonths}}/g, "36")
    .replace(/{{contract\.explanation}}/g, explanation || (isEn ? "Agreed by mutual consent" : "Convenit de comun acord"))
    .replace(/{{contract\.notes}}/g, contractObject || (isEn ? "Services performed according to annex." : "Lucrările se execută conform anexei."))
    .replace(/{{contract\.offerNumber}}/g, resolvedOfferNumber)
    .replace(/{{contract\.offerDate}}/g, resolvedOfferDate)
    .replace(/{{contract\.durationMonths}}/g, String(totMonths))
    .replace(/{{contract\.renewalMonths}}/g, String(renMonths))
    .replace(/{{contract\.basePrice}}/g, basePriceStr)
    .replace(/{{contract\.promoPrice}}/g, promoPriceStr)
    .replace(/{{contract\.trialMonths}}/g, String(tMonths));

  // Inlocuire blocuri de clauze comerciale
  if (isSignage) {
    raw = raw
      .replace(/{{commercial\.art3}}/g, finalArt3Signage)
      .replace(/{{commercial\.art4}}/g, finalArt4Signage);
  } else {
    raw = raw
      .replace(/{{commercial\.art3}}/g, finalArt3SmartQr)
      .replace(/{{commercial\.art5}}/g, finalArt5SmartQr)
      .replace(/{{commercial\.pricingTable}}/g, pricingTableHtml)
      .replace(/{{commercial\.prorataTable}}/g, prorataTableHtml);
  }

  // Inlocuire date Contract Parinte (pentru Act Aditional)
  if (parentContract) {
    raw = raw
      .replace(/{{parentContract\.number}}/g, parentContract.number)
      .replace(/{{parentContract\.date}}/g, parentContract.date);
  } else {
    raw = raw
      .replace(/{{parentContract\.number}}/g, isEn ? "principal" : "principal")
      .replace(/{{parentContract\.date}}/g, docDate);
  }

  return raw;
}
