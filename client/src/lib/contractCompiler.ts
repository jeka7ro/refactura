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
}: CompileTemplateParams): string {
  let raw = rawHtml || "";

  const isEn = docLanguage === "en";
  const isBilingual = docLanguage === "ro_en";

  const activeTenantName = tenant?.name || "Compania Ta";
  const activeTenantCui = tenant?.cui || tenantSettings?.cui || tenantSettings?.fiscalCode || "-";
  const activeTenantRegCom = tenantSettings?.regCom || "-";
  const activeTenantCity = tenantSettings?.city || "București";
  const activeTenantAddress = tenant?.address || tenantSettings?.address || "-";
  const activeTenantIban = tenantSettings?.iban || "-";
  const activeTenantBank = tenantSettings?.bank || "-";

  // Inlocuire date Furnizor (Tenant)
  raw = raw
    .replace(/{{tenant\.name}}/g, activeTenantName)
    .replace(/{{tenant\.cui}}/g, activeTenantCui)
    .replace(/{{tenant\.regCom}}/g, activeTenantRegCom)
    .replace(/{{tenant\.city}}/g, activeTenantCity)
    .replace(/{{tenant\.address}}/g, activeTenantAddress)
    .replace(/{{tenant\.iban}}/g, activeTenantIban)
    .replace(/{{tenant\.bank}}/g, activeTenantBank)
    .replace(/{{tenant\.delegat}}/g, "Elena Cazmal, Administrator")
    .replace(/{{tenant\.phone}}/g, "+40 757 77 77 12")
    .replace(/{{tenant\.email}}/g, "contact@getapp.ro");

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

  // Inlocuire variabile comerciale contract
  raw = raw
    .replace(/{{contract\.number}}/g, docNumber)
    .replace(/{{contract\.date}}/g, docDate)
    .replace(/{{contract\.value}}/g, docValue)
    .replace(/{{contract\.currency}}/g, docCurrency)
    .replace(/{{contract\.paymentTerm}}/g, paymentTermDays)
    .replace(/{{contract\.deliveryDays}}/g, deliveryDays)
    .replace(/{{contract\.warrantyMonths}}/g, warrantyMonths)
    .replace(/{{contract\.glassWarrantyMonths}}/g, "36")
    .replace(/{{contract\.explanation}}/g, explanation || (isEn ? "Agreed by mutual consent" : "Convenit de comun acord"))
    .replace(/{{contract\.notes}}/g, contractObject || (isEn ? "Services performed according to annex." : "Lucrările se execută conform anexei."))
    .replace(/{{contract\.offerNumber}}/g, "OFR-" + docNumber.replace(/\D/g, ""))
    .replace(/{{contract\.offerDate}}/g, docDate)
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
