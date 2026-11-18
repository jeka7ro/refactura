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
