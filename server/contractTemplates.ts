/**
 * Șabloane Oficiale de Contracte în Română, Engleză și Bilingv (RO + EN)
 * Trade Invest Network & WOOD GLASS
 */

export type ContractLanguage = "ro" | "en" | "ro_en";

interface TemplateOptions {
  tenantId: number;
  tenantName: string;
  tenantCui: string;
  isTradeInvest: boolean;
  isWoodGlass: boolean;
  language: ContractLanguage;
}

export interface ContractTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  language: ContractLanguage;
  contentHtml: string;
}

/**
 * 1. Șablon SaaS GetApp Smart QR (Pontaj & Art. 119 Codul Muncii)
 */
function getSmartQrTemplate(lang: ContractLanguage): ContractTemplate {
  const isEn = lang === "en";
  const isBilingual = lang === "ro_en";

  let name = "Contract SaaS GetApp Smart QR (Pontaj & Art. 119 Codul Muncii)";
  let description = "Șablon complet: GetApp Smart QR, servere Germania ISO 27001, plan 15 luni (€3.50 promo / €4.00 standard), regula 15 zile, Anexa 1 și Anexa 2 DPA GDPR.";

  if (isEn) {
    name = "GetApp Smart QR SaaS Agreement (Time Tracking & Labor Compliance)";
    description = "Complete English template: GetApp Smart QR, ISO 27001 German servers, 15-month plan, 15-day fluctuation rule, Annex 1 and Annex 2 DPA GDPR.";
  } else if (isBilingual) {
    name = "Contract Bilingv SaaS GetApp Smart QR (Română - Engleză / RO - EN)";
    description = "Format profesional bilingv pe două coloane paralele (RO/EN): GetApp Smart QR, servere Germania ISO 27001, Anexa 1 și Anexa 2 DPA GDPR.";
  }

  // Antet comun
  const headerHtml = `
  <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <img src="/uploads/logos/getapp_smart_qr_logo.png" alt="GetApp Smart QR Logo" style="height: 54px; width: auto; object-fit: contain;" />
      <div>
        <h1 style="color: #1e3a8a; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">GetApp Smart QR</h1>
        <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">
          ${
            isEn
              ? "Digital Time Tracking & Labor Attendance Platform • www.getapp.ro • Email: contact@getapp.ro • Tel: +40 757 77 77 12"
              : isBilingual
              ? "Platforma Digitală de Pontaj / Digital Time Tracking Platform • www.getapp.ro • Email: contact@getapp.ro • Tel: +40 757 77 77 12"
              : "Platforma Digitală de Pontaj & Evidența Muncii • www.getapp.ro • Email: contact@getapp.ro • Tel: +40 757 77 77 12"
          }
        </p>
      </div>
    </div>
    <div style="text-align: right;">
      <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">
        ${isEn ? "Art. 119 Labor Code" : isBilingual ? "Art. 119 Codul Muncii / Labor Code" : "Art. 119 Codul Muncii"}
      </span>
    </div>
  </div>`;

  const bilingualBanner = isBilingual
    ? `
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 18px; font-size: 10px; color: #475569; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <strong style="color: #1e3a8a;">CONTRACT BILINGV (ROMÂNĂ - ENGLEZĂ) / BILINGUAL AGREEMENT (ROMANIAN - ENGLISH)</strong><br/>
      În caz de discrepanțe între cele două versiuni lingvistice, versiunea în limba română va prevala. / In case of discrepancies between the two language versions, the Romanian version shall prevail.
    </div>
    <span style="background: #1e3a8a; color: #ffffff; font-weight: bold; padding: 3px 7px; border-radius: 4px; font-size: 9px; text-transform: uppercase; white-space: nowrap;">
      RO • EN
    </span>
  </div>`
    : "";

  let titleHtml = "";
  if (isEn) {
    titleHtml = `
  <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin: 15px 0 4px 0; text-transform: uppercase; font-weight: 800;">
    SOFTWARE AS A SERVICE (SAAS) AGREEMENT
  </h2>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 13px; margin: 0 0 4px 0;">
    No. {{contract.number}} dated {{contract.date}}
  </p>
  <p style="text-align: center; font-size: 10px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin: 0 0 20px 0;">
    COMPLIANCE WITH ART. 119 OF THE ROMANIAN LABOR CODE
  </p>`;
  } else if (isBilingual) {
    titleHtml = `
  <h2 style="text-align: center; color: #0f172a; font-size: 15px; margin: 15px 0 4px 0; text-transform: uppercase; font-weight: 800;">
    CONTRACT DE PRESTĂRI SERVICII SOFTWARE (SAAS) / SOFTWARE AS A SERVICE (SAAS) AGREEMENT
  </h2>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 12px; margin: 0 0 4px 0;">
    Nr. {{contract.number}} din data de {{contract.date}} / No. {{contract.number}} dated {{contract.date}}
  </p>
  <p style="text-align: center; font-size: 10px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin: 0 0 16px 0;">
    CONFORMITATE ART. 119 CODUL MUNCII / COMPLIANCE WITH ART. 119 LABOR CODE
  </p>`;
  } else {
    titleHtml = `
  <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin: 15px 0 4px 0; text-transform: uppercase; font-weight: 800;">
    CONTRACT DE PRESTĂRI SERVICII SOFTWARE (SAAS)
  </h2>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 13px; margin: 0 0 4px 0;">
    Nr. {{contract.number}} din data de {{contract.date}}
  </p>
  <p style="text-align: center; font-size: 10px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin: 0 0 20px 0;">
    CONFORMITATE ART. 119 CODUL MUNCII
  </p>`;
  }

  // Secțiunea 1: Părțile Contractante
  let art1Html = "";
  if (isEn) {
    art1Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    1. CONTRACTING PARTIES
  </h3>
  <table style="width: 100%; margin-bottom: 18px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <strong style="color: #1e3a8a; font-size: 11px;">SERVICE PROVIDER</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Headquarters: {{tenant.city}}, {{tenant.address}}<br/>
        Tax ID (CUI): {{tenant.cui}} • Reg. Com.: {{tenant.regCom}}<br/>
        IBAN: {{tenant.iban}} ({{tenant.bank}})<br/>
        Legal representative: Elena Cazmal, Administrator<br/>
        Phone: +40 757 77 77 12 • Email: contact@getapp.ro
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <strong style="color: #1e3a8a; font-size: 11px;">BENEFICIARY (CUSTOMER)</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        Headquarters: {{partner.city}}, {{partner.address}}<br/>
        Tax ID (CUI/VAT): {{partner.cui}} • Reg. Com.: {{partner.regCom}}<br/>
        IBAN: {{partner.iban}} ({{partner.bank}})<br/>
        Legal representative: {{partner.delegat}}<br/>
        Phone: {{partner.phone}} • Email: {{partner.email}}
      </td>
    </tr>
  </table>`;
  } else if (isBilingual) {
    art1Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    1. PĂRȚILE CONTRACTANTE / CONTRACTING PARTIES
  </h3>
  <table style="width: 100%; margin-bottom: 18px; font-size: 10.5px; border-collapse: collapse; border: 1px solid #cbd5e1;">
    <tr style="background-color: #f8fafc;">
      <td style="width: 50%; vertical-align: top; padding: 10px; border-right: 1px solid #cbd5e1;">
        <strong style="color: #1e3a8a;">1.1. FURNIZOR (PRESTATOR) / SERVICE PROVIDER:</strong><br/>
        <strong>{{tenant.name}}</strong>, sediu / headquarters: {{tenant.city}}, {{tenant.address}}, CUI / Tax ID: {{tenant.cui}}, Reg. Com.: {{tenant.regCom}}, IBAN: {{tenant.iban}} ({{tenant.bank}}), reprezentată prin / represented by: Elena Cazmal, Administrator, Tel: +40 757 77 77 12, Email: contact@getapp.ro.
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #1e3a8a;">1.2. BENEFICIAR (CLIENT) / BENEFICIARY (CUSTOMER):</strong><br/>
        <strong>{{partner.name}}</strong>, sediu / headquarters: {{partner.city}}, {{partner.address}}, CUI/VAT: {{partner.cui}}, Reg. Com.: {{partner.regCom}}, IBAN: {{partner.iban}} ({{partner.bank}}), reprezentată prin / represented by: {{partner.delegat}}, Tel: {{partner.phone}}, Email: {{partner.email}}.
      </td>
    </tr>
  </table>`;
  } else {
    art1Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    1. PĂRȚILE CONTRACTANTE
  </h3>
  <table style="width: 100%; margin-bottom: 18px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <strong style="color: #1e3a8a; font-size: 11px;">FURNIZOR (PRESTATOR)</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Sediu: {{tenant.city}}, {{tenant.address}}<br/>
        CUI: {{tenant.cui}} • Reg. Com.: {{tenant.regCom}}<br/>
        IBAN: {{tenant.iban}} ({{tenant.bank}})<br/>
        Reprezentant legal: Elena Cazmal, Administrator<br/>
        Telefon: +40 757 77 77 12 • Email: contact@getapp.ro
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <strong style="color: #1e3a8a; font-size: 11px;">BENEFICIAR (CLIENT)</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        Sediu: {{partner.city}}, {{partner.address}}<br/>
        CUI/CIF: {{partner.cui}} • Reg. Com.: {{partner.regCom}}<br/>
        IBAN: {{partner.iban}} ({{partner.bank}})<br/>
        Reprezentant legal: {{partner.delegat}}<br/>
        Telefon: {{partner.phone}} • Email: {{partner.email}}
      </td>
    </tr>
  </table>`;
  }

  // Secțiunea 2: Obiectul Contractului
  let art2Html = "";
  if (isEn) {
    art2Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    2. OBJECT OF THE AGREEMENT AND INCLUDED DIGITAL INFRASTRUCTURE
  </h3>
  <p style="margin: 6px 0;"><strong>2.1.</strong> Granting of the non-exclusive right to access and use the cloud software platform ("GetApp Smart QR Platform"), accessible via web, kiosk, and mobile devices, as well as providing all associated digital infrastructure.</p>
  <p style="margin: 6px 0;"><strong>2.2. Enterprise Infrastructure Included 100%:</strong> The subscription includes at no additional cost: hosting on high-performance dedicated servers located in Germany (ISO/IEC 27001 certified data centers / EU), domain management and secure licensing (getapp.ro), 256-bit SSL/TLS certificate, unlimited traffic, automated database backup twice daily, advanced anti-DDoS protection, automated security updates, and permanent technical maintenance.</p>
  <p style="margin: 6px 0;"><strong>2.3.</strong> The platform ensures accurate tracking of working hours, recording start and end times, meal breaks, and shift schedules in strict compliance with Art. 119 of Law no. 53/2003 - Romanian Labor Code, republished.</p>`;
  } else if (isBilingual) {
    art2Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    2. OBIECTUL CONTRACTULUI / OBJECT OF THE AGREEMENT
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">
        <p style="margin: 4px 0;"><strong>2.1.</strong> Acordarea dreptului neexclusiv de acces și utilizare a platformei software cloud („Platforma GetApp Smart QR”), pe web, kiosk și dispozitive mobile, precum și întreaga infrastructură digitală.</p>
        <p style="margin: 4px 0;"><strong>2.2. Infrastructură Enterprise Inclusă 100%:</strong> Găzduire pe servere dedicate de înaltă performanță localizate în Germania (centre de date certificate ISO/IEC 27001 / UE), domeniu securizat getapp.ro, certificat SSL/TLS 256 biți, trafic nelimitat, backup automat de 2 ori pe zi, protecție anti-DDoS și actualizări automate.</p>
        <p style="margin: 4px 0;"><strong>2.3.</strong> Evidența exactă a orelor de muncă, începere/sfârșit program, pauze și schimburi, conform strict cu Art. 119 din Legea nr. 53/2003 - Codul Muncii.</p>
      </td>
      <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">
        <p style="margin: 4px 0;"><strong>2.1.</strong> Granting the non-exclusive right to access and use the cloud platform ("GetApp Smart QR Platform") on web, kiosk, and mobile devices, including all digital infrastructure.</p>
        <p style="margin: 4px 0;"><strong>2.2. Enterprise Infrastructure Included 100%:</strong> Hosting on dedicated high-performance servers in Germany (ISO/IEC 27001 certified data centers / EU), secure domain getapp.ro, 256-bit SSL/TLS, unlimited bandwidth, automated backup twice daily, anti-DDoS, and automated updates.</p>
        <p style="margin: 4px 0;"><strong>2.3.</strong> Accurate tracking of work hours, start/end times, breaks, and shifts, in strict compliance with Art. 119 of Law no. 53/2003 - Labor Code.</p>
      </td>
    </tr>
  </table>`;
  } else {
    art2Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    2. OBIECTUL CONTRACTULUI ȘI INFRASTRUCTURA DIGITALĂ INCLUSĂ
  </h3>
  <p style="margin: 6px 0;"><strong>2.1.</strong> Acordarea dreptului neexclusiv de acces și utilizare a platformei software cloud („Platforma GetApp Smart QR”), disponibilă pe web, kiosk și dispozitive mobile, precum și asigurarea întregii infrastructuri digitale aferente.</p>
  <p style="margin: 6px 0;"><strong>2.2. Infrastructură Enterprise Inclusă 100%:</strong> Abonamentul include fără costuri suplimentare: găzduirea pe servere dedicate de înaltă performanță localizate în Germania (centre de date certificate ISO/IEC 27001 / UE), administrarea și licențierea domeniului web securizat (getapp.ro), certificat SSL/TLS de 256 biți, trafic nelimitat, backup automat zilnic de 2 ori pe zi, protecție avansată anti-DDoS, actualizări automate de securitate și mentenanță permanentă.</p>
  <p style="margin: 6px 0;"><strong>2.3.</strong> Platforma asigură evidența exactă a orelor de muncă, înregistrarea orelor de începere și sfârșit de program, a pauzelor și schimburilor, în conformitate strictă cu Art. 119 din Legea nr. 53/2003 - Codul Muncii, republicată.</p>`;
  }

  // Secțiunea 3: Valoarea Contractului & Plăți (injectat via {{commercial.art3}})
  const art3Title = isEn
    ? "3. CONTRACT VALUE, FLUCTUATION BILLING AND PAYMENT TERMS"
    : isBilingual
    ? "3. VALOAREA CONTRACTULUI ȘI TERMENI DE PLATĂ / CONTRACT VALUE & PAYMENT TERMS"
    : "3. VALOAREA CONTRACTULUI, FACTURAREA FLUCTUAȚIILOR ȘI TERMENUL DE PLATĂ";

  // Secțiunea 4: Obligațiile Părților
  let art4Html = "";
  if (isEn) {
    art4Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    4. OBLIGATIONS OF THE PARTIES
  </h3>
  <p style="margin: 6px 0;"><strong>4.1. Provider:</strong> Guarantees monthly service level availability (SLA) of at least 99.5%, maintenance and security of servers in Germany, automated database backups twice daily, and priority technical assistance.</p>
  <p style="margin: 6px 0;"><strong>4.2. Customer:</strong> Pays invoices within the 7-day contractual deadline, ensures working hardware at business locations, and maintains the confidentiality of assigned PIN codes.</p>`;
  } else if (isBilingual) {
    art4Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    4. OBLIGAȚIILE PĂRȚILOR / OBLIGATIONS OF THE PARTIES
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">
        <p style="margin: 4px 0;"><strong>4.1. Furnizorul:</strong> Garantează disponibilitatea (SLA) de cel puțin 99,5% lunar, mentenanța serverelor din Germania, backup de 2 ori pe zi și suport prioritar.</p>
        <p style="margin: 4px 0;"><strong>4.2. Beneficiarul:</strong> Achită facturile în termen de 7 zile, asigură echipamentele hardware și păstrează confidențialitatea PIN-urilor.</p>
      </td>
      <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">
        <p style="margin: 4px 0;"><strong>4.1. Provider:</strong> Guarantees monthly SLA of at least 99.5%, maintenance of German servers, backups twice daily, and priority support.</p>
        <p style="margin: 4px 0;"><strong>4.2. Customer:</strong> Pays invoices within 7 days, ensures hardware equipment, and maintains secrecy of assigned PINs.</p>
      </td>
    </tr>
  </table>`;
  } else {
    art4Html = `
  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    4. OBLIGAȚIILE PĂRȚILOR
  </h3>
  <p style="margin: 6px 0;"><strong>4.1. Furnizorul:</strong> Garantează disponibilitatea serviciului (SLA) de cel puțin 99,5% lunar, mentenanța și securitatea serverelor din Germania, backup automat al bazei de date de 2 ori pe zi și asistență tehnică prioritară.</p>
  <p style="margin: 6px 0;"><strong>4.2. Beneficiarul:</strong> Achită facturile în termenul contractual de 7 zile, asigură echipamentele hardware la locații și păstrează confidențialitatea PIN-urilor alocate.</p>`;
  }

  // Secțiunea 5: Durata Contractului
  const art5Title = isEn
    ? "5. DURATION OF AGREEMENT ({{contract.durationMonths}} MONTHS) AND AUTOMATIC RENEWAL"
    : isBilingual
    ? "5. DURATA CONTRACTULUI ({{contract.durationMonths}} LUNI) ȘI PRELUNGIREA / DURATION ({{contract.durationMonths}} MONTHS) & RENEWAL"
    : "5. DURATA CONTRACTULUI ({{contract.durationMonths}} LUNI) ȘI PRELUNGIREA AUTOMATĂ";

  // Semnături
  let signaturesHtml = "";
  if (isEn) {
    signaturesHtml = `
  <table style="width: 100%; margin-top: 30px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #1e3a8a;">FOR THE SERVICE PROVIDER</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Elena Cazmal, Administrator<br/>
        Tel: +40 757 77 77 12 • Email: contact@getapp.ro<br/>
        Signature: ______________________ L.S.
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #1e3a8a;">FOR THE CUSTOMER</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        Representative: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}<br/>
        Signature: ______________________ L.S.
      </td>
    </tr>
  </table>`;
  } else if (isBilingual) {
    signaturesHtml = `
  <table style="width: 100%; margin-top: 30px; font-size: 11px; border-collapse: collapse; border-top: 1px solid #cbd5e1; padding-top: 15px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px; border-right: 1px solid #cbd5e1;">
        <strong style="color: #1e3a8a;">PENTRU FURNIZOR / FOR PROVIDER</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Elena Cazmal, Administrator / Managing Director<br/>
        Tel: +40 757 77 77 12 • Email: contact@getapp.ro<br/>
        Semnătura / Signature: ______________________ L.S.
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #1e3a8a;">PENTRU BENEFICIAR / FOR CUSTOMER</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        Reprezentant / Representative: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}<br/>
        Semnătura / Signature: ______________________ L.S.
      </td>
    </tr>
  </table>`;
  } else {
    signaturesHtml = `
  <table style="width: 100%; margin-top: 30px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #1e3a8a;">PENTRU FURNIZOR</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Elena Cazmal, Administrator<br/>
        Tel: +40 757 77 77 12 • Email: contact@getapp.ro<br/>
        Semnătura: ______________________ L.S.
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #1e3a8a;">PENTRU BENEFICIAR</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        Reprezentant: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}<br/>
        Semnătura: ______________________ L.S.
      </td>
    </tr>
  </table>`;
  }

  // Anexa 1 & Anexa 2
  let annex1Title = isEn
    ? "ANNEX NO. 1 TO SAAS AGREEMENT NO. {{contract.number}} DATED {{contract.date}}"
    : isBilingual
    ? "ANEXA NR. 1 / ANNEX NO. 1 (SAAS NR. {{contract.number}} / {{contract.date}})"
    : "ANEXA NR. 1 LA CONTRACTUL SAAS NR. {{contract.number}} DIN {{contract.date}}";

  let annex1Subtitle = isEn
    ? "Technical and Financial Annex • Digital Infrastructure & Pricing Plan for {{contract.durationMonths}} Months"
    : isBilingual
    ? "Anexă Tehnică și Financiară / Technical & Financial Annex • Plan {{contract.durationMonths}} Luni/Months"
    : "Anexă Tehnică și Financiară • Infrastructură Digitală și Plan Tarifar pe {{contract.durationMonths}} Luni";

  let annex2Title = isEn
    ? "ANNEX NO. 2 TO SAAS AGREEMENT NO. {{contract.number}} DATED {{contract.date}}"
    : isBilingual
    ? "ANEXA NR. 2 / ANNEX NO. 2 (DPA • ART. 28 GDPR)"
    : "ANEXA NR. 2 LA CONTRACTUL SAAS NR. {{contract.number}} DIN {{contract.date}}";

  const contentHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1e293b; max-width: 820px; margin: 0 auto; font-size: 12px;">
  ${headerHtml}
  ${bilingualBanner}
  ${titleHtml}

  ${art1Html}
  ${art2Html}

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${art3Title}
  </h3>
  {{commercial.art3}}

  ${art4Html}

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${art5Title}
  </h3>
  {{commercial.art5}}

  ${signaturesHtml}

  <!-- ANEXA 1 -->
  <div style="page-break-before: always; margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 25px;">
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/uploads/logos/getapp_smart_qr_logo.png" alt="GetApp Smart QR" style="height: 42px; width: auto; object-fit: contain;" />
        <div>
          <strong style="color: #1e3a8a; font-size: 14px; font-weight: 800;">GetApp Smart QR</strong>
          <div style="font-size: 10px; color: #64748b;">${isEn ? "Digital Time Tracking Platform • www.getapp.ro" : "Platforma Digitală de Pontaj • www.getapp.ro"}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; font-weight: bold; color: #475569;">${isEn ? "Technical & Financial Annex" : isBilingual ? "Anexă Tehnică / Annex" : "Anexă Tehnică & Financiară"}</span>
      </div>
    </div>
    <h3 style="text-align: center; color: #1e3a8a; font-size: 13px; text-transform: uppercase; margin: 0 0 10px 0;">
      ${annex1Title}
    </h3>
    <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 0;">
      ${annex1Subtitle}
    </p>

    <h4 style="color: #0f172a; font-size: 11px; text-transform: uppercase; margin-top: 15px; margin-bottom: 6px;">
      ${isEn ? "1. DIGITAL INFRASTRUCTURE & SOFTWARE MODULES INCLUDED 100%" : isBilingual ? "1. INFRASTRUCTURĂ DIGITALĂ INCLUSĂ 100% / INCLUDED INFRASTRUCTURE" : "1. INFRASTRUCTURA DIGITALĂ ȘI MODULE SOFTWARE INCLUSE 100% ÎN ABONAMENT"}
    </h4>
    <ul style="font-size: 11px; margin: 4px 0 12px 20px; line-height: 1.6;">
      <li><strong>${isEn ? "Enterprise Dedicated Servers in Germany (EU):" : "Servere Enterprise Dedicate în Germania (UE):"}</strong> ${isEn ? "High-speed infrastructure in ISO/IEC 27001 and SOC 2 certified data centers with automated anti-DDoS and advanced firewall;" : "Infrastructură de mare viteză în centre de date certificate ISO/IEC 27001 și SOC 2, cu protecție automată anti-DDoS și firewall avansat;"}</li>
      <li><strong>${isEn ? "Secure Web Domain & SSL/TLS Encryption:" : "Domeniu Web Securizat & Criptare SSL/TLS:"}</strong> ${isEn ? "Full management of getapp.ro, 256-bit SSL certificates, unlimited bandwidth, and HTTPS encryption;" : "Administrarea completă a domeniului getapp.ro, certificate SSL pe 256 de biți, trafic de date nelimitat și conexiuni criptate HTTPS;"}</li>
      <li><strong>${isEn ? "Automated Backups & Redundant Retention:" : "Salvări Automate (Backup) & Retenție Redundantă:"}</strong> ${isEn ? "Automated database backup twice daily with legal archiving and retention of logs;" : "Backup automat al bazei de date de 2 ori pe zi, cu arhivare și reținere istorică a pontajelor conform legii;"}</li>
      <li><strong>${isEn ? "Maintenance, Continuous Patches & Updates:" : "Mentenanță, Patch-uri și Actualizări Continue:"}</strong> ${isEn ? "Security and speed updates delivered instantly via cloud with zero maintenance fees;" : "Optimizări de securitate, viteză și funcții noi livrate instant în cloud, fără taxe de upgrade sau mentenanță;"}</li>
      <li><strong>${isEn ? "Dynamic & Static QR Code Module:" : "Modul Coduri QR Dinamice & Statice:"}</strong> ${isEn ? "Anti-fraud protection via rotating dynamic QR on tablet/kiosk or secured static QR code;" : "Protecție anti-fraudă prin rotire dinamică a codului QR pe ecranul kiosk/tabletă sau cod static securizat;"}</li>
      <li><strong>${isEn ? "Dual Attendance Scanning:" : "Scanare Duală:"}</strong> ${isEn ? "Scanning via mobile smartphone camera or location kiosk via Employee Code + 4-digit PIN;" : "Pontare prin camera telefonului mobil sau direct pe Kiosk-ul locației prin Cod Angajat + PIN de 4 cifre;"}</li>
      <li><strong>${isEn ? "Labor Code Art. 119 Compliance:" : "Conformitate Art. 119 Codul Muncii:"}</strong> ${isEn ? "Exact second-by-second tracking of check-ins, check-outs, meal breaks, and overtime hours;" : "Înregistrare exactă la secundă a intrărilor, ieșirilor, pauzelor de masă și orelor suplimentare;"}</li>
      <li><strong>${isEn ? "Digital Reports & Accounting Export:" : "Rapoarte Digitale & Export Contabilitate:"}</strong> ${isEn ? "Individual attendance timesheets and monthly centralizer fully compatible with Saga / Excel." : "Fișă individuală de pontaj pentru fiecare salariat și centralizator lunar compatibil Saga / Excel."}</li>
    </ul>

    <h4 style="color: #0f172a; font-size: 11px; text-transform: uppercase; margin-top: 15px; margin-bottom: 6px;">
      ${isEn ? "2. CONTRACTUAL PRICING PLAN FOR {{contract.durationMonths}} MONTHS" : isBilingual ? "2. PLANUL TARIFAR CONTRACTUAL / PRICING PLAN" : "2. PLANUL TARIFAR CONTRACTUAL PE {{contract.durationMonths}} LUNI"}
    </h4>
    {{commercial.pricingTable}}

    <h4 style="color: #0f172a; font-size: 11px; text-transform: uppercase; margin-top: 15px; margin-bottom: 6px;">
      ${isEn ? "3. PRO-RATA AND FLUCTUATION RULES FOR NEW, DEPARTED OR TRANSFERRED EMPLOYEES" : isBilingual ? "3. REGULI DE CALCUL ȘI PRO-RATA / PRO-RATA RULES" : "3. REGULI DE CALCUL ȘI AFIȘARE PRO-RATA LA FLUCTUAȚII ȘI MIGRARE ÎNTRE LOCAȚII"}
    </h4>
    {{commercial.prorataTable}}

    <h4 style="color: #0f172a; font-size: 11px; text-transform: uppercase; margin-top: 15px; margin-bottom: 6px;">
      ${isEn ? "4. SERVICE LEVEL AGREEMENT (SLA) & SUPPORT" : isBilingual ? "4. NIVEL DE SERVICII (SLA) & ASISTENȚĂ / SLA & SUPPORT" : "4. NIVEL DE SERVICII (SLA) ȘI ASISTENȚĂ TEHNICĂ"}
    </h4>
    <p style="margin: 6px 0;">${isEn ? "The Provider guarantees monthly platform availability of at least <strong>99.5%</strong>. Priority technical support via WhatsApp and email at contact@getapp.ro, with response time under 2 hours between 08:00 – 20:00." : "Furnizorul asigură disponibilitate lunară a platformei de cel puțin <strong>99,5%</strong>. Asistență tehnică prioritară prin WhatsApp și email la contact@getapp.ro, cu timp de reacție sub 2 ore în intervalul 08:00 – 20:00."}</p>
  </div>

  <!-- ANEXA 2: GDPR DPA -->
  <div style="page-break-before: always; margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 25px;">
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/uploads/logos/getapp_smart_qr_logo.png" alt="GetApp Smart QR" style="height: 42px; width: auto; object-fit: contain;" />
        <div>
          <strong style="color: #1e3a8a; font-size: 14px; font-weight: 800;">GetApp Smart QR</strong>
          <div style="font-size: 10px; color: #64748b;">${isEn ? "Data Processing Agreement (GDPR)" : "Acord Prelucrare Date cu Caracter Personal (GDPR)"}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 10px; font-weight: bold; padding: 3px 6px; border-radius: 4px;">
          Art. 28 GDPR
        </span>
      </div>
    </div>
    <h3 style="text-align: center; color: #1e3a8a; font-size: 13px; text-transform: uppercase; margin: 0 0 10px 0;">
      ${annex2Title}
    </h3>
    <h4 style="text-align: center; color: #0f172a; font-size: 12px; text-transform: uppercase; margin: 0 0 15px 0;">
      ${isEn ? "DATA PROCESSING AGREEMENT (DPA • ART. 28 GDPR)" : isBilingual ? "ACORD DE PRELUCRARE A DATELOR CU CARACTER PERSONAL / DATA PROCESSING AGREEMENT" : "ACORD DE PRELUCRARE A DATELOR CU CARACTER PERSONAL (DPA • ART. 28 GDPR)"}
    </h4>
    <p style="font-size: 11px; line-height: 1.6;">
      ${
        isEn
          ? "Executed between <strong>{{partner.name}}</strong> (as Data Controller) and <strong>{{tenant.name}}</strong> (as Data Processor), as an integral part of the SaaS Agreement, in compliance with Article 28 of Regulation (EU) 2016/679 (GDPR)."
          : "Încheiat între <strong>{{partner.name}}</strong> (în calitate de Operator de date) și <strong>{{tenant.name}}</strong> (în calitate de Persoană Împuternicită de Operator), ca parte integrantă din Contractul SaaS, în conformitate cu cerințele Art. 28 din Regulamentul (UE) 2016/679 (GDPR)."
      }
    </p>

    <p style="margin: 6px 0;"><strong>${isEn ? "1. PURPOSE AND SCOPE:" : "1. OBIECTUL, NATURA ȘI SCOPUL PRELUCRĂRII:"}</strong> ${isEn ? "The Data Processor processes data strictly for the provision of secure digital time tracking, monitoring hours worked pursuant to Art. 119 Labor Code, and generating monthly reports." : "Persoana Împuternicită prelucrează datele puse la dispoziție de Operator exclusiv în scopul furnizării serviciilor de pontaj electronic securizat, monitorizare a orelor lucrate conform Art. 119 Codul Muncii și generare a rapoartelor lunare de prezență."}</p>
    <p style="margin: 6px 0;"><strong>${isEn ? "2. CATEGORIES OF DATA SUBJECTS AND DATA:" : "2. CATEGORII DE PERSOANE VIZATE ȘI DATE PRELUCRATE:"}</strong> ${isEn ? "Employees and collaborators of the Controller. Identification data (name, employee code, work branch), attendance data (exact scan timestamps, breaks, shifts), and security data (PIN, IP, device)." : "Salariații și colaboratorii Operatorului înregistrați în platformă. Date de identificare (nume, prenume, cod intern angajat, punct de lucru), date de pontaj (data și ora exactă a scanării, pauze, ieșiri, normă) și date tehnice de securitate (PIN alocat, dispozitiv, IP)."}</p>
    <p style="margin: 6px 0;"><strong>${isEn ? "3. LEGAL BASIS:" : "3. TEMEIUL LEGAL AL PRELUCRĂRII:"}</strong> ${isEn ? "Compliance with a legal obligation (Art. 6(1)(c) GDPR and Art. 119 Labor Code) and performance of employment contract (Art. 6(1)(b) GDPR)." : "Îndeplinirea unei obligații legale (Art. 6 alin. 1 lit. c GDPR coroborat cu Art. 119 Codul Muncii) și executarea contractului individual de muncă (Art. 6 alin. 1 lit. b GDPR)."}</p>
    <p style="margin: 6px 0;"><strong>${isEn ? "4. PROCESSOR OBLIGATIONS:" : "4. OBLIGAȚIILE PERSOANEI ÎMPUTERNICITE (FURNIZORUL):"}</strong> ${isEn ? "Process data solely upon documented instructions; maintain confidentiality; implement technical measures (TLS encryption, backups 2x/day); notify security breaches within 48 hours; assist with data subject rights; export and permanently erase data upon contract termination." : "Să prelucreze datele exclusiv pe baza instrucțiunilor documentate ale Operatorului; să asigure păstrarea confidențialității; să implementeze măsurile tehnice cerute de Art. 32 GDPR (criptare TLS, backup de 2 ori pe zi); să notifice incidentele de securitate în cel mult 48 de ore; să asigure suport pentru exercitarea drepturilor salariaților; să asigure exportul integral și ștergerea definitivă la încetarea contractului."}</p>
    <p style="margin: 6px 0;"><strong>${isEn ? "5. SERVER LOCATION IN GERMANY (EU) & SECURITY:" : "5. LOCALIZAREA SERVERELOR ÎN GERMANIA (UE) ȘI SECURITATE:"}</strong> ${isEn ? "All data is hosted and processed exclusively in enterprise ISO/IEC 27001 certified data centers in Germany (European Union). Transfer outside the EEA without prior written consent is strictly prohibited." : "Toate datele sunt găzduite și procesate exclusiv în centre de date enterprise certificate ISO/IEC 27001 situate în Germania (Uniunea Europeană), beneficiind de backup geo-redundant și protecție avansată anti-DDoS. Este strict interzis transferul datelor în afara Spațiului Economic European fără acordul prealabil scris al Operatorului."}</p>
  </div>
</div>`;

  return {
    id: "contract-saas-smart-qr",
    name,
    type: "contract",
    description,
    language: lang,
    contentHtml,
  };
}

/**
 * 2. Șablon Digital Signage Smart Displays (Ecrane TV & Meniuri Digitale)
 */
function getDigitalSignageTemplate(lang: ContractLanguage): ContractTemplate {
  const isEn = lang === "en";
  const isBilingual = lang === "ro_en";

  let name = "Contract Digital Signage Smart Displays (Ecrane TV & Meniuri Digitale)";
  let description = "Șablon complet: platformă Smart Displays, domeniu https://{{partner.subdomain}}.smr.onl/, gestiune autonomă, SLA 99.5%, tarif 10.00 EUR/ecran/lună și Anexa 1 TV.";

  if (isEn) {
    name = "Digital Signage Smart Displays Agreement (TV Screens & Digital Menus)";
    description = "Complete English template: Smart Displays platform, dedicated domain, autonomous management, 99.5% SLA, €10.00/screen/month, and Annex 1 TV screens.";
  } else if (isBilingual) {
    name = "Contract Bilingv Digital Signage Smart Displays (Română - Engleză / RO - EN)";
    description = "Format bilingv pe două coloane paralele (RO/EN): Smart Displays, domeniu dedicat, gestiune autonomă, tarif ecran și Anexa 1 ecrane TV.";
  }

  const headerHtml = `
  <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <img src="/uploads/logos/getapp_smart_displays_logo.png" alt="GetApp Smart Displays Logo" style="height: 52px; max-width: 250px; width: auto; object-fit: contain;" />
      <div>
        <p style="margin: 0; font-size: 11px; color: #64748b;">
          ${isEn ? "Digital TV Screens & Digital Menus Platform • www.getapp.ro • Email: contact@getapp.ro • Tel: +40 757 77 77 12" : "Platforma Digitală de Ecrane TV & Meniuri Digitale • www.getapp.ro • Email: contact@getapp.ro • Tel: +40 757 77 77 12"}
        </p>
      </div>
    </div>
    <div style="text-align: right;">
      <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">
        Digital Signage Cloud
      </span>
    </div>
  </div>`;

  const bilingualBanner = isBilingual
    ? `
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 18px; font-size: 10px; color: #475569; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <strong style="color: #0369a1;">CONTRACT BILINGV (ROMÂNĂ - ENGLEZĂ) / BILINGUAL AGREEMENT (ROMANIAN - ENGLISH)</strong><br/>
      În caz de discrepanțe între cele două versiuni, versiunea în limba română va prevala. / In case of discrepancies between the two versions, the Romanian version shall prevail.
    </div>
    <span style="background: #0369a1; color: #ffffff; font-weight: bold; padding: 3px 7px; border-radius: 4px; font-size: 9px; text-transform: uppercase; white-space: nowrap;">
      RO • EN
    </span>
  </div>`
    : "";

  let titleHtml = "";
  if (isEn) {
    titleHtml = `
  <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin: 15px 0 3px 0; text-transform: uppercase; font-weight: 800;">
    DIGITAL SERVICES AGREEMENT (DIGITAL SIGNAGE)
  </h2>
  <p style="text-align: center; font-size: 12px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">
    TV SCREEN CONTENT MANAGEMENT AND BROADCASTING
  </p>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 13px; margin: 0 0 20px 0;">
    Contract No. {{contract.number}} dated {{contract.date}}
  </p>`;
  } else if (isBilingual) {
    titleHtml = `
  <h2 style="text-align: center; color: #0f172a; font-size: 15px; margin: 15px 0 3px 0; text-transform: uppercase; font-weight: 800;">
    CONTRACT DE PRESTĂRI SERVICII DIGITALE / DIGITAL SERVICES AGREEMENT (DIGITAL SIGNAGE)
  </h2>
  <p style="text-align: center; font-size: 11px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">
    GESTIUNE ȘI REDARE CONȚINUT PE ECRANE TV / TV SCREEN CONTENT MANAGEMENT
  </p>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 12px; margin: 0 0 16px 0;">
    Contract Nr. {{contract.number}} din data de {{contract.date}} / Contract No. {{contract.number}} dated {{contract.date}}
  </p>`;
  } else {
    titleHtml = `
  <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin: 15px 0 3px 0; text-transform: uppercase; font-weight: 800;">
    CONTRACT DE PRESTĂRI SERVICII DIGITALE (DIGITAL SIGNAGE)
  </h2>
  <p style="text-align: center; font-size: 12px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">
    GESTIUNE ȘI REDARE CONȚINUT PE ECRANE TV
  </p>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 13px; margin: 0 0 20px 0;">
    Contract Nr. {{contract.number}} din data de {{contract.date}}
  </p>`;
  }

  // Părțile contractante
  let art1Html = `
  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${isEn ? "1. CONTRACTING PARTIES" : isBilingual ? "1. PĂRȚILE CONTRACTANTE / CONTRACTING PARTIES" : "1. PĂRȚILE CONTRACTANTE"}
  </h3>
  <table style="width: 100%; margin-bottom: 18px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <strong style="color: #0369a1; font-size: 11px;">${isEn ? "PROVIDER" : "FURNIZOR (PRESTATOR)"}</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        ${isEn ? "Headquarters" : "Sediu"}: {{tenant.city}}, {{tenant.address}}<br/>
        CUI: {{tenant.cui}} • Reg. Com.: {{tenant.regCom}}<br/>
        IBAN: {{tenant.iban}} ({{tenant.bank}})<br/>
        ${isEn ? "Legal representative" : "Reprezentant legal"}: Elena Cazmal, Administrator<br/>
        ${isEn ? "Phone" : "Telefon"}: +40 757 77 77 12 • Email: contact@getapp.ro
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <strong style="color: #0369a1; font-size: 11px;">${isEn ? "CUSTOMER" : "BENEFICIAR (CLIENT)"}</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        ${isEn ? "Headquarters" : "Sediu"}: {{partner.city}}, {{partner.address}}<br/>
        CUI/CIF: {{partner.cui}} • Reg. Com.: {{partner.regCom}}<br/>
        IBAN: {{partner.iban}} ({{partner.bank}})<br/>
        ${isEn ? "Legal representative" : "Reprezentant legal"}: {{partner.delegat}}<br/>
        ${isEn ? "Phone" : "Telefon"}: {{partner.phone}} • Email: {{partner.email}}
      </td>
    </tr>
  </table>`;

  // Obiectul contractului
  let art2Html = "";
  if (isEn) {
    art2Html = `
  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    2. OBJECT OF THE AGREEMENT AND AUTONOMOUS TV SCREEN MANAGEMENT
  </h3>
  <p style="margin: 6px 0;"><strong>2.1.</strong> Granting of the non-exclusive right to access and use the cloud platform ("GetApp Smart Displays Platform"), accessible at the dedicated URL <strong>https://{{partner.subdomain}}.smr.onl/</strong> for Smart TVs and digital signage, as well as providing full server infrastructure.</p>
  <p style="margin: 6px 0;"><strong>2.2. Autonomous TV Screen Creation:</strong> Customer creates, configures, and manages independently from the web account (<strong>https://{{partner.subdomain}}.smr.onl/</strong>) as many TV screens as needed for restaurant/store locations.</p>
  <p style="margin: 6px 0;"><strong>2.3. Enterprise Infrastructure Included 100%:</strong> Dedicated high-performance EU servers (ISO/IEC 27001 certified data centers), dedicated subdomain https://{{partner.subdomain}}.smr.onl/, 256-bit SSL, unlimited traffic, daily automated media backups, anti-DDoS, and automatic updates.</p>
  <p style="margin: 6px 0;"><strong>2.4. Features:</strong> Centralized control, dynamic digital menus, promo graphics, 4K/Full HD videos, scheduled playlists, Happy Hour mode with countdown timers, multi-screen sync, and seasonal effects.</p>`;
  } else if (isBilingual) {
    art2Html = `
  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    2. OBIECTUL CONTRACTULUI / OBJECT OF THE AGREEMENT
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #cbd5e1; line-height: 1.5;">
        <p style="margin: 4px 0;"><strong>2.1.</strong> Drept neexclusiv de acces la platforma „GetApp Smart Displays” la adresa <strong>https://{{partner.subdomain}}.smr.onl/</strong> pentru televizoare Smart TV.</p>
        <p style="margin: 4px 0;"><strong>2.2. Gestiune autonomă:</strong> Beneficiarul își creează și gestionează independent oricâte ecrane TV are nevoie din contul său web.</p>
        <p style="margin: 4px 0;"><strong>2.3. Infrastructură inclusă:</strong> Servere enterprise UE (ISO 27001), domeniu dedicat https://{{partner.subdomain}}.smr.onl/, SSL 256 biți, backup zilnic și anti-DDoS.</p>
      </td>
      <td style="width: 50%; vertical-align: top; padding-left: 12px; line-height: 1.5;">
        <p style="margin: 4px 0;"><strong>2.1.</strong> Non-exclusive right to access "GetApp Smart Displays" platform at <strong>https://{{partner.subdomain}}.smr.onl/</strong> for Smart TVs.</p>
        <p style="margin: 4px 0;"><strong>2.2. Autonomous management:</strong> Customer creates and manages independently as many TV screens as needed from the web account.</p>
        <p style="margin: 4px 0;"><strong>2.3. Included infrastructure:</strong> Enterprise EU servers (ISO 27001), dedicated domain https://{{partner.subdomain}}.smr.onl/, SSL 256-bit, daily backups and anti-DDoS.</p>
      </td>
    </tr>
  </table>`;
  } else {
    art2Html = `
  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    2. OBIECTUL CONTRACTULUI ȘI GESTIUNEA AUTONOMĂ A ECRANELOR
  </h3>
  <p style="margin: 6px 0;"><strong>2.1.</strong> Acordarea dreptului neexclusiv de acces și utilizare a platformei software cloud („Platforma GetApp Smart Displays”) accesibilă la adresa dedicată <strong>https://{{partner.subdomain}}.smr.onl/</strong> pentru televizoare Smart TV și afișaje digitale, precum și asigurarea întregii infrastructuri de servere și administrare a conținutului vizual.</p>
  <p style="margin: 6px 0;"><strong>2.2. Crearea autonomă a ecranelor TV:</strong> Beneficiarul își creează, configurează și gestionează în mod independent, direct din contul de client pe platforma web (<strong>https://{{partner.subdomain}}.smr.onl/</strong>), câte ecrane TV are nevoie pentru restaurantele / punctele sale de lucru. Platforma monitorizează automat numărul ecranelor active.</p>
  <p style="margin: 6px 0;"><strong>2.3. Infrastructura Enterprise și Servicii Incluse 100%:</strong> Abonamentul include: găzduirea pe servere dedicate de înaltă performanță localizate în Uniunea Europeană (centre de date certificate ISO/IEC 27001), alocarea și administrarea domeniului dedicat securizat https://{{partner.subdomain}}.smr.onl/, certificat SSL/TLS de 256 biți, trafic nelimitat, backup automat zilnic al conținutului, protecție avansată anti-DDoS, actualizări automate de securitate și mentenanță continuă.</p>
  <p style="margin: 6px 0;"><strong>2.4. Funcționalități platformă:</strong> Gestiune centralizată, distribuție meniuri digitale dinamice, imagini promoționale, videoclipuri Full HD / 4K, playlist-uri programate orar, modul Happy Hour cu temporizator, sincronizare ecrane și efecte de sezon.</p>`;
  }

  const art3Title = isEn
    ? "3. FREE TRIAL, MONTHLY TARIFF AND INVOICING"
    : isBilingual
    ? "3. PERIOADA GRATUITĂ, TARIFUL LUNAR ȘI FACTURAREA / TRIAL, PRICING & INVOICING"
    : "3. PERIOADA GRATUITĂ, TARIFUL LUNAR ȘI FACTURAREA";

  const art4Title = isEn
    ? "4. DURATION OF AGREEMENT ({{contract.durationMonths}} MONTHS) AND TERMINATION"
    : isBilingual
    ? "4. DURATA CONTRACTULUI ({{contract.durationMonths}} LUNI) ȘI PRELUNGIREA / DURATION & RENEWAL"
    : "4. DURATA CONTRACTULUI ({{contract.durationMonths}} LUNI), PRELUNGIREA AUTOMATĂ ȘI REZILIEREA";

  const contentHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1e293b; max-width: 820px; margin: 0 auto; font-size: 12px;">
  ${headerHtml}
  ${bilingualBanner}
  ${titleHtml}

  ${art1Html}
  ${art2Html}

  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${art3Title}
  </h3>
  {{commercial.art3}}

  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${art4Title}
  </h3>
  {{commercial.art4}}

  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${isEn ? "5. OBLIGATIONS OF THE PARTIES" : isBilingual ? "5. OBLIGAȚIILE PĂRȚILOR / OBLIGATIONS OF THE PARTIES" : "5. OBLIGAȚIILE PĂRȚILOR"}
  </h3>
  <p style="margin: 6px 0;"><strong>${isEn ? "5.1. Provider:" : "5.1. Furnizorul:"}</strong> ${isEn ? "Guarantees monthly cloud service availability (SLA) of at least 99.5%, maintenance and security of servers, automated daily media backup, and priority support." : "Garantează disponibilitatea serviciului cloud (SLA) de cel puțin 99,5% lunar, mentenanța și securitatea serverelor dedicate, backup automat zilnic al conținutului media, precum și asistență tehnică prioritară."}</p>
  <p style="margin: 6px 0;"><strong>${isEn ? "5.2. Customer:" : "5.2. Beneficiarul:"}</strong> ${isEn ? "Ensures operational TV displays and internet connection; pays invoices monthly based on active screens; remains solely responsible for copyrights of displayed media." : "Asigură echipamentele TV funcționale și conexiunea stabilă la internet în restaurante; achită facturile lunare emise conform ecranelor active create și utilizate; răspunde exclusiv de legalitatea și drepturile de autor ale conținutului grafic încărcat pe ecrane."}</p>

  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${isEn ? "6. INTELLECTUAL PROPERTY & BROADCAST CONTENT" : isBilingual ? "6. PROPRIETATE INTELECTUALĂ / INTELLECTUAL PROPERTY" : "6. PROPRIETATE INTELECTUALĂ ȘI CONȚINUTUL DIFUZAT PE ECRANE"}
  </h3>
  <p style="margin: 6px 0;"><strong>6.1.</strong> ${isEn ? "The software platform, source code, and rendering algorithms belong exclusively to the Provider (SaaS license)." : "Platforma software, arhitectura tehnică și algoritmii de redare aparțin în totalitate Furnizorului (licență temporară SaaS)."}</p>
  <p style="margin: 6px 0;"><strong>6.2.</strong> ${isEn ? "The Customer retains full ownership of all advertising graphics, logos, menu items, and media loaded onto screens." : "Beneficiarul păstrează integral toate drepturile de proprietate asupra materialelor publicitare, imaginilor de produse, siglei și ofertelor încărcate pe ecrane."}</p>

  <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase; margin-top: 18px;">
    ${isEn ? "7. SERVICE LEVEL AGREEMENT (SLA) & DISPUTES" : isBilingual ? "7. GARANȚII (SLA) ȘI LITIGII / SLA & DISPUTES" : "7. GARANȚII DE DISPONIBILITATE (SLA) ȘI LIMITAREA RĂSPUNDERII"}
  </h3>
  <p style="margin: 6px 0;"><strong>7.1.</strong> ${isEn ? "Guaranteed monthly cloud uptime of <strong>99.5%</strong>. Disputes resolved amicably or by competent courts of Bucharest." : "Furnizorul asigură o disponibilitate a serverelor cloud de <strong>99,5% lunar</strong>. Eventualele litigii se vor soluționa pe cale amiabilă sau de instanțele judecătorești competente din București."}</p>

  <table style="width: 100%; margin-top: 30px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #0369a1;">${isEn ? "FOR THE PROVIDER:" : "PENTRU FURNIZOR:"}</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Elena Cazmal, Administrator<br/>
        Tel: +40 757 77 77 12 • Email: contact@getapp.ro<br/>
        ${isEn ? "Signature and Stamp: L.S." : "Semnătura și Ștampila: L.S."}
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong style="color: #0369a1;">${isEn ? "FOR THE CUSTOMER:" : "PENTRU BENEFICIAR:"}</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        ${isEn ? "Representative" : "Reprezentant"}: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}<br/>
        ${isEn ? "Signature and Stamp: L.S." : "Semnătura și Ștampila: L.S."}
      </td>
    </tr>
  </table>

  <!-- ANEXA 1 ECRANE ACTIVE -->
  <div style="page-break-before: always; margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 25px;">
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/uploads/logos/getapp_smart_displays_logo.png" alt="GetApp Smart Displays" style="height: 38px; max-width: 190px; width: auto; object-fit: contain;" />
        <span style="font-size: 11px; color: #64748b;">${isEn ? "Digital TV Screens & Digital Menus Platform" : "Platforma Digitală de Ecrane TV & Meniuri Digitale"}</span>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: bold; padding: 3px 6px; border-radius: 4px;">
          ${isEn ? "Annex 1: Active TV Screens" : "Anexa 1: Ecrane Active"}
        </span>
      </div>
    </div>
    <h3 style="text-align: center; color: #0369a1; font-size: 13px; text-transform: uppercase; margin: 0 0 10px 0;">
      ${isEn ? "ANNEX 1: LIST OF ACTIVE TV SCREENS" : isBilingual ? "ANEXA 1: LISTA ECRANELOR TV ACTIVE / LIST OF ACTIVE TV SCREENS" : "ANEXA 1: LISTA ECRANELOR TV ACTIVE"}
    </h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 15px 0; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #1e293b;">
          <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 40px;">No.</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "Location / Restaurant" : "Locație / Restaurant"}</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "TV Display Name" : "Denumire Ecran TV"}</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">${isEn ? "TV Link (Slug)" : "Link TV (Slug)"}</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 80px;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">1.</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">{{partner.name}}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">TV Display 1</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace;">{{partner.subdomain}}-tv1</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; color: #16a34a; font-weight: bold;">${isEn ? "Active" : "Activ"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">2.</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">{{partner.name}}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">TV Display 2</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace;">{{partner.subdomain}}-tv2</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; color: #16a34a; font-weight: bold;">${isEn ? "Active" : "Activ"}</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size: 11px; color: #64748b; margin-top: 10px; line-height: 1.5;">
      * ${
        isEn
          ? "The unique slug enables autonomous setup on Smart TV web browsers. The Customer may add extra screens anytime directly from the platform (<strong>https://{{partner.subdomain}}.smr.onl/</strong>), billed at the contractual rate of 10.00 EUR + VAT / screen / month."
          : "Link-ul unic (slug) permite conectarea și redarea automată a conținutului pe Smart TV. Beneficiarul poate adăuga și activa oricând ecrane suplimentare direct din platforma web (<strong>https://{{partner.subdomain}}.smr.onl/</strong>), acestea urmând a fi facturate automat la tariful agreat de 10,00 EUR + TVA / ecran activ / lună."
      }
    </p>
  </div>
</div>`;

  return {
    id: "contract-saas-digital-signage",
    name,
    type: "contract",
    description,
    language: lang,
    contentHtml,
  };
}

/**
 * 3. Șablon Oficial Contract Tip Wood Glass (Modele Oficiale 393 Intern PF/PJ, 324 Extern PF, 392/364 Extern PJ)
 */
function getWoodGlassTipTemplate(lang: ContractLanguage): ContractTemplate {
  const isEn = lang === "en";
  const isBilingual = lang === "ro_en";

  let name = "Contract Tip Vânzare-Cumpărare Tâmplărie — S.C. WOOD GLASS S.R.L. (Intern 393 / Extern 324 & 392)";
  let description =
    "Modelele oficiale S.C. WOOD GLASS S.R.L.: Intern PF/PJ (Model 393, PV predare-primire, inclusiv TVA), Extern PF (Model 324, CMR, cu TVA) și Extern PJ (Model 392/364, CMR, fără TVA).";

  if (isEn) {
    name = "Standard Sale-Purchase Agreement for Joinery — S.C. WOOD GLASS S.R.L. (Official Models 393 / 324 / 392)";
    description =
      "Official S.C. WOOD GLASS S.R.L. contracts: Domestic Individual/Company (393), International Individual (324) & International Company (392/364).";
  } else if (isBilingual) {
    name = "Contract Tip Bilingv Vânzare-Cumpărare Tâmplărie — S.C. WOOD GLASS S.R.L. (RO - EN)";
  }

  const contentHtml = `
<div style="font-family: Cambria, Georgia, 'Times New Roman', serif; line-height: 1.55; color: #0f172a; max-width: 820px; margin: 0 auto; font-size: 12.5px;">
  <div style="border-bottom: 1.5px solid #0284c7; padding-bottom: 6px; margin-bottom: 10px;">
    <h2 style="color: #334155; font-size: 15.5px; margin: 0; font-weight: normal; letter-spacing: 0.3px;">
      CONTRACT Nr. {{contract.number}}
    </h2>
  </div>
  <p style="margin: 0 0 18px 0; font-size: 13px; color: #0f172a;">
    din data de {{contract.date}}
  </p>
  {{wg.contractBody}}
</div>`;

  return {
    id: "contract-woodglass-tip",
    name,
    type: "contract",
    description,
    language: lang,
    contentHtml,
  };
}

/**
 * 3. Șablon Cadru General / Software / Vânzări
 */
function getCadruGeneralTemplate(lang: ContractLanguage, isTradeInvest: boolean, isWoodGlass: boolean): ContractTemplate {
  const isEn = lang === "en";
  const isBilingual = lang === "ro_en";

  let name = isTradeInvest
    ? "Contract Cadru de Prestări Servicii Software & Digitale"
    : isWoodGlass
    ? "Contract Cadru de Furnizare Tâmplărie & Montaj"
    : "Contract Cadru de Furnizare / Prestări Servicii";

  if (isEn) {
    name = isTradeInvest
      ? "Framework Agreement for Software & Digital Services"
      : "Commercial Framework Agreement for Services & Supply";
  } else if (isBilingual) {
    name = "Contract Cadru Bilingv (Română - Engleză / Framework Agreement)";
  }

  const contentHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1e293b; max-width: 820px; margin: 0 auto; font-size: 12px;">
  ${
    isBilingual
      ? `
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 18px; font-size: 10px; color: #475569;">
    <strong>CONTRACT BILINGV (ROMÂNĂ - ENGLEZĂ) / BILINGUAL AGREEMENT (ROMANIAN - ENGLISH)</strong><br/>
    Versiunea în limba română va prevala în caz de divergențe. / The Romanian language version shall prevail in case of discrepancies.
  </div>`
      : ""
  }

  <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin: 15px 0 4px 0; text-transform: uppercase; font-weight: 800;">
    ${isEn ? "COMMERCIAL FRAMEWORK AGREEMENT" : isBilingual ? "CONTRACT CADRU COMERCIAL / COMMERCIAL FRAMEWORK AGREEMENT" : isWoodGlass ? "CONTRACT CADRU DE FURNIZARE ȘI MONTAJ TÂMPLĂRIE" : "CONTRACT CADRU DE FURNIZARE ȘI SERVICII"}
  </h2>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 13px; margin: 0 0 20px 0;">
    ${isEn ? "No. {{contract.number}} dated {{contract.date}}" : "Nr. {{contract.number}} din data de {{contract.date}}"}
  </p>

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase;">
    ${isEn ? "1. CONTRACTING PARTIES" : isBilingual ? "1. PĂRȚILE CONTRACTANTE / CONTRACTING PARTIES" : "1. PĂRȚILE CONTRACTANTE"}
  </h3>
  <table style="width: 100%; margin-bottom: 15px; font-size: 11px; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <strong style="color: #1e3a8a;">${isEn ? "PROVIDER" : "PRESTATOR / FURNIZOR"}:</strong><br/>
        <strong>{{tenant.name}}</strong><br/>
        Sediu: {{tenant.city}}, {{tenant.address}}<br/>
        CUI: {{tenant.cui}} • Reg. Com.: {{tenant.regCom}}<br/>
        IBAN: {{tenant.iban}} ({{tenant.bank}})<br/>
        Reprezentant: {{tenant.delegat}}<br/>
        Tel: {{tenant.phone}} • Email: {{tenant.email}}
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <strong style="color: #1e3a8a;">${isEn ? "BENEFICIARY / CUSTOMER" : "BENEFICIAR / CLIENT"}:</strong><br/>
        <strong>{{partner.name}}</strong><br/>
        Sediu: {{partner.city}}, {{partner.address}}<br/>
        CUI: {{partner.cui}} • Reg. Com.: {{partner.regCom}}<br/>
        IBAN: {{partner.iban}} ({{partner.bank}})<br/>
        Reprezentant: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}
      </td>
    </tr>
  </table>

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase;">
    ${isEn ? "2. SCOPE OF AGREEMENT" : isBilingual ? "2. OBIECTUL CONTRACTULUI / SCOPE OF AGREEMENT" : "2. OBIECTUL CONTRACTULUI"}
  </h3>
  <p>2.1. ${
    isWoodGlass
      ? isEn
        ? "Production, delivery, and installation of laminated wood joinery, insulated glass units, and related accessories according to the agreed technical offers and specifications."
        : "Producția, livrarea și, după caz, montajul elementelor de tâmplărie din lemn stratificat, sticlă termoizolantă și accesorii conexe, conform ofertelor de preț și anexelor tehnice agreate de ambele părți."
      : isEn
      ? "Provision of software services, digital cloud solutions, and technical support as agreed in subsequent purchase orders."
      : "Prestarea de servicii și livrarea de produse conform comenzilor și specificațiilor tehnice agreate."
  }</p>

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase;">
    ${isEn ? "3. VALUE AND PAYMENT TERMS" : isBilingual ? "3. VALOARE ȘI PLĂȚI / VALUE AND PAYMENT" : "3. VALOAREA CONTRACTULUI ȘI MODALITĂȚI DE PLATĂ"}
  </h3>
  <p>3.1. ${isEn ? "Estimated total value: <strong>{{contract.value}} {{contract.currency}}</strong>." : "Valoarea totală estimată: <strong>{{contract.value}} {{contract.currency}}</strong>."}</p>
  <p>3.2. ${isEn ? "Payment term: <strong>{{contract.paymentTerm}} calendar days</strong> from invoice date." : "Termen de plată: <strong>{{contract.paymentTerm}} zile</strong> de la data emiterii facturii."}</p>

  <table style="width: 100%; margin-top: 40px; font-size: 11px;">
    <tr>
      <td style="width: 50%; vertical-align: top;">
        <strong>${isEn ? "FOR PROVIDER" : "FURNIZOR / PRESTATOR"}</strong><br/>
        {{tenant.name}}<br/>
        Reprezentant: {{tenant.delegat}}<br/>
        Tel: {{tenant.phone}} • Email: {{tenant.email}}<br/>
        __________________________
      </td>
      <td style="width: 50%; vertical-align: top;">
        <strong>${isEn ? "FOR CUSTOMER" : "BENEFICIAR / CLIENT"}</strong><br/>
        {{partner.name}}<br/>
        Reprezentant: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}<br/>
        __________________________
      </td>
    </tr>
  </table>
</div>`;

  return {
    id: "contract-cadru-general",
    name,
    type: "contract",
    description: isWoodGlass
      ? "Șablon cadru pentru comenzi periodice de tâmplărie lemn stratificat și montaj."
      : isEn
      ? "Framework agreement for services and supply based on specific orders."
      : "Șablon cadru comercial pe bază de comenzi sau proiecte punctuale.",
    language: lang,
    contentHtml,
  };
}

/**
 * 4. Șablon Act Adițional
 */
function getActAditionalTemplate(lang: ContractLanguage, isTradeInvest: boolean = false, isWoodGlass: boolean = false): ContractTemplate {
  const isEn = lang === "en";
  const isBilingual = lang === "ro_en";

  let name = isWoodGlass
    ? isEn
      ? "Addendum — Modification of Technical Offer / Joinery Specifications / Value"
      : "Act Adițional — Modificare Ofertă Tehnică / Dimensiuni Tâmplărie / Valoare"
    : isEn
    ? "Addendum / Amendment — Terms / Prices / Scope"
    : isBilingual
    ? "Act Adițional Bilingv (Română - Engleză / Addendum Amendment)"
    : "Act Adițional — Modificare Termene / Prețuri / Obiect";

  const contentHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1e293b; max-width: 820px; margin: 0 auto; font-size: 12px;">
  ${
    isBilingual
      ? `
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 18px; font-size: 10px; color: #475569;">
    <strong>ACT ADIȚIONAL BILINGV / BILINGUAL ADDENDUM</strong><br/>
    Versiunea în limba română va prevala în caz de divergențe. / The Romanian version shall prevail in case of discrepancies.
  </div>`
      : ""
  }

  <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin: 15px 0 4px 0; text-transform: uppercase; font-weight: 800;">
    ${isEn ? "ADDENDUM NO. {{contract.number}}" : isBilingual ? "ACT ADIȚIONAL / ADDENDUM NO. {{contract.number}}" : "ACT ADIȚIONAL Nr. {{contract.number}}"}
  </h2>
  <p style="text-align: center; font-weight: bold; color: #475569; font-size: 12px; margin: 0 0 20px 0;">
    ${isEn ? "To Contract No. {{parentContract.number}} dated {{parentContract.date}}" : "La Contractul Nr. {{parentContract.number}} din data de {{parentContract.date}}"}
  </p>

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase;">
    ${isEn ? "CONTRACTING PARTIES" : isBilingual ? "PĂRȚILE CONTRACTANTE / PARTIES" : "PĂRȚILE CONTRACTANTE"}
  </h3>
  <p>${
    isEn
      ? "Between <strong>{{tenant.name}}</strong> (Provider, CUI {{tenant.cui}}, Reg. Com. {{tenant.regCom}}, represented by {{tenant.delegat}}, Tel: {{tenant.phone}}, Email: {{tenant.email}}) and <strong>{{partner.name}}</strong> (Customer, CUI {{partner.cui}}, represented by {{partner.delegat}}, Tel: {{partner.phone}}, Email: {{partner.email}})."
      : "Între <strong>{{tenant.name}}</strong> (Furnizor, CUI {{tenant.cui}}, Reg. Com. {{tenant.regCom}}, reprezentată prin {{tenant.delegat}}, Tel: {{tenant.phone}}, Email: {{tenant.email}}) și <strong>{{partner.name}}</strong> (Beneficiar, CUI {{partner.cui}}, reprezentată prin {{partner.delegat}}, Tel: {{partner.phone}}, Email: {{partner.email}})."
  }</p>

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase;">
    ${isEn ? "ARTICLE 1. OBJECT OF ADDENDUM" : isBilingual ? "ARTICOLUL 1. OBIECT / SCOPE" : "ARTICOLUL 1. OBIECTUL ACTULUI ADIȚIONAL"}
  </h3>
  <p>${isEn ? "The Parties agree to modify the contractual terms starting on <strong>{{contract.date}}</strong>:" : "Părțile convin de comun acord modificarea următoarelor clauze începând cu <strong>{{contract.date}}</strong>:"}</p>
  <p><em>{{contract.explanation}}</em></p>

  <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 12px; text-transform: uppercase;">
    ${isEn ? "ARTICLE 2. MODIFIED CLAUSES" : isBilingual ? "ARTICOLUL 2. CLAUZE MODIFICATE / MODIFIED CLAUSES" : "ARTICOLUL 2. CLAUZE MODIFICATE"}
  </h3>
  <p>2.1. ${
    isWoodGlass
      ? "Valoarea actualizată / suplimentară a lucrărilor conform prezentului act adițional este de <strong>{{contract.value}} {{contract.currency}}</strong>."
      : isEn
      ? "Payment term becomes: <strong>{{contract.paymentTerm}} calendar days</strong>."
      : "Termenul de plată agreat devine <strong>{{contract.paymentTerm}} zile</strong> de la emiterea facturii."
  }</p>
  <p>2.2. ${
    isWoodGlass
      ? "Celelalte clauze ale Contractului de Vânzare-Cumpărare Nr. {{parentContract.number}} rămân neschimbate și pe deplin valabile."
      : isEn
      ? "Additional order value: <strong>{{contract.value}} {{contract.currency}}</strong>."
      : "Valoarea adițională este de <strong>{{contract.value}} {{contract.currency}}</strong>."
  }</p>

  <table style="width: 100%; margin-top: 40px; font-size: 11px;">
    <tr>
      <td style="width: 50%; vertical-align: top;">
        <strong>${isEn ? "PROVIDER" : "FURNIZOR"}</strong><br/>
        {{tenant.name}}<br/>
        Reprezentant: {{tenant.delegat}}<br/>
        Tel: {{tenant.phone}} • Email: {{tenant.email}}<br/>
        __________________________
      </td>
      <td style="width: 50%; vertical-align: top;">
        <strong>${isEn ? "CUSTOMER" : "BENEFICIAR"}</strong><br/>
        {{partner.name}}<br/>
        Reprezentant: {{partner.delegat}}<br/>
        Tel: {{partner.phone}} • Email: {{partner.email}}<br/>
        __________________________
      </td>
    </tr>
  </table>
</div>`;

  return {
    id: "act-aditional-modificare",
    name,
    type: "act_aditional",
    description: isWoodGlass
      ? "Pentru lucrări suplimentare, modificarea ofertei tehnice, dimensiunilor tâmplăriei, valorii sau termenului de livrare."
      : isEn
      ? "For amending contractual scope, rates, or terms."
      : "Pentru modificarea clauzelor, tarifelor sau termenelor contractuale.",
    language: lang,
    contentHtml,
  };
}

/**
 * Funcția centrală de obținere a tuturor șabloanelor în limba dorită, strict izolate pe tenant
 */
export function getAllContractTemplates(options: TemplateOptions): ContractTemplate[] {
  const { isTradeInvest, isWoodGlass, language } = options;

  const cadruGeneral = getCadruGeneralTemplate(language, isTradeInvest, isWoodGlass);
  const actAditional = getActAditionalTemplate(language, isTradeInvest, isWoodGlass);

  if (isWoodGlass) {
    const wgTip = getWoodGlassTipTemplate(language);
    return [wgTip, actAditional, cadruGeneral];
  }

  if (isTradeInvest) {
    const smartQr = getSmartQrTemplate(language);
    const signage = getDigitalSignageTemplate(language);
    return [smartQr, signage, actAditional, cadruGeneral];
  }

  return [cadruGeneral, actAditional];
}
