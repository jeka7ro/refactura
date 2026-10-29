/**
 * Codurile de unitate din e-Factura (UN/ECE Rec. 20, ex. H87, MTR, KGM) se afișează ca denumiri românești
 * (buc, m, kg...). "M4" nu este o unitate de măsură în UN/ECE (înseamnă „valoare monetară”) —
 * unii furnizori îl folosesc greșit pentru bucăți, deci îl afișăm ca „buc”.
 */
const UNIT_LABELS: Record<string, string> = {
  H87: "buc", C62: "buc", EA: "buc", PCE: "buc", NMP: "buc", XPP: "buc", NAR: "buc", M4: "buc",
  KGM: "kg", GRM: "g", TNE: "t", LTR: "l", MLT: "ml",
  MTR: "m", CMT: "cm", MMT: "mm", MTK: "mp", MTQ: "mc",
  SET: "set", HUR: "oră", DAY: "zi", MON: "lună",
  BX: "cutie", XBX: "cutie", RO: "rolă", XRO: "rolă", PK: "pachet", XPK: "pachet", BG: "sac", XBG: "sac",
};

export function unitLabel(code?: string | null): string {
  const raw = String(code ?? "").trim();
  if (!raw) return "buc";
  return UNIT_LABELS[raw.toUpperCase()] || raw;
}
