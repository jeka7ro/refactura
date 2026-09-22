/**
 * Proxy VIES (Vat Information Exchange System - Comisia Europeană)
 * GET /api/vies/:cui
 * GET /api/vies/:country/:vatNumber
 */
import type { Express, Request, Response } from "express";

// Codurile de țară UE acceptate de VIES
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES",
  "FI", "FR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI"
]);

export interface ViesLookupResult {
  valid: boolean;
  country: string;
  vatNumber: string;
  cui: string;
  denumire: string;
  adresa: string;
  fullAddress: string;
  oras: string;
  judet: string;
  codPostal: string;
  tva: boolean;
  source: "vies";
  raw?: any;
}

export async function fetchViesData(countryInput: string, vatInput: string): Promise<ViesLookupResult | { valid: false; error: string }> {
  let country = countryInput.trim().toUpperCase();
  // Grecia folosește 'EL' în VIES, dar utilizatorii introduc des 'GR'
  if (country === "GR") country = "EL";

  let vatNumber = vatInput.trim().replace(/\s/g, "").toUpperCase();
  // Dacă vatNumber include și prefixul de țară (ex: 'DE123456789'), eliminăm prefixul
  if (vatNumber.startsWith(country)) {
    vatNumber = vatNumber.slice(country.length);
  }
  // În caz că prefixul era 'GR' dar country a devenit 'EL'
  if (country === "EL" && vatNumber.startsWith("GR")) {
    vatNumber = vatNumber.slice(2);
  }

  if (!EU_COUNTRIES.has(country)) {
    return { valid: false, error: `Țara '${country}' nu este un stat membru UE valid în sistemul VIES.` };
  }

  if (!vatNumber || vatNumber.length < 2) {
    return { valid: false, error: "Numărul de TVA este prea scurt sau invalid." };
  }

  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${encodeURIComponent(vatNumber)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "SmartInvoice-Refactura/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { valid: false, error: `Codul ${country}${vatNumber} nu a fost găsit în VIES.` };
      }
      return { valid: false, error: `Serviciul VIES a returnat eroarea HTTP ${res.status}.` };
    }

    const data = await res.json();

    if (!data.isValid) {
      return {
        valid: false,
        error: `Codul de TVA ${country}${vatNumber} nu este valid sau nu este înregistrat pentru tranzacții intracomunitare în VIES.`,
      };
    }

    // Parsare nume și adresă
    const denumire = (data.name || "").replace(/^---$/, "").trim();
    const rawAddress = (data.address || "").replace(/^---$/, "").trim();

    // Încercăm să descompunem adresa pe linii (deseori VIES returnează: "Stradă\nCodPostal Oraș")
    const lines = rawAddress
      .split(/[\r\n]+/)
      .map((l: string) => l.trim())
      .filter(Boolean);

    let adresa = rawAddress;
    let oras = "";
    let codPostal = "";

    if (lines.length >= 2) {
      adresa = lines.slice(0, lines.length - 1).join(", ");
      const lastLine = lines[lines.length - 1];
      // Căutare cod poștal la începutul ultimei linii (ex: "1740 Ternat" sau "B-1000 Bruxelles")
      const cpMatch = lastLine.match(/^([A-Z0-9-]{3,10})\s+(.+)$/i);
      if (cpMatch) {
        codPostal = cpMatch[1];
        oras = cpMatch[2];
      } else {
        oras = lastLine;
      }
    } else if (lines.length === 1) {
      adresa = lines[0];
      // Verificăm dacă există virgulă pentru oraș la final
      const parts = lines[0].split(",").map((p: string) => p.trim());
      if (parts.length > 1) {
        oras = parts[parts.length - 1];
        adresa = parts.slice(0, -1).join(", ");
      }
    }

    // Prefixul afișat utilizatorului (ex: 'GR' este afișat de obicei ca 'EL' în TVA, dar păstrăm country)
    const cuiPrefix = country === "EL" ? "EL" : country;

    return {
      valid: true,
      country: country === "EL" ? "GR" : country,
      vatNumber: data.vatNumber || vatNumber,
      cui: `${cuiPrefix}${data.vatNumber || vatNumber}`,
      denumire,
      adresa: adresa || rawAddress,
      fullAddress: rawAddress,
      oras,
      judet: "",
      codPostal,
      tva: true,
      source: "vies",
      raw: data,
    };
  } catch (err: any) {
    console.error("[VIES Proxy] Error calling VIES API:", err.message);
    if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
      return { valid: false, error: "Serviciul VIES al Comisiei Europene nu a răspuns în timp util (timeout)." };
    }
    return { valid: false, error: "Eroare la conectarea la serviciul VIES: " + (err.message || "necunoscută") };
  }
}

export function registerViesProxy(app: Express) {
  // GET /api/vies/:cui (unde cui poate fi 'DE123456789', 'BE0785292895', 'IE6388047V', etc.)
  app.get("/api/vies/:cui", async (req: Request, res: Response) => {
    const rawCui = String(req.params.cui || "").trim().replace(/\s/g, "").toUpperCase();

    // Verificăm dacă are prefix de țară (primele 2 caractere)
    const match = rawCui.match(/^([A-Z]{2})(.*)$/);
    if (!match) {
      return res.status(400).json({
        error: "Codul VIES trebuie să înceapă cu codul de țară format din 2 litere (ex: DE123456789, BE0785292895).",
      });
    }

    const country = match[1];
    const vatNumber = match[2];

    const result = await fetchViesData(country, vatNumber);
    if (!result.valid) {
      return res.status(404).json(result);
    }

    return res.json(result);
  });

  // GET /api/vies/:country/:vatNumber
  app.get("/api/vies/:country/:vatNumber", async (req: Request, res: Response) => {
    const country = String(req.params.country || "").trim().toUpperCase();
    const vatNumber = String(req.params.vatNumber || "").trim();

    const result = await fetchViesData(country, vatNumber);
    if (!result.valid) {
      return res.status(404).json(result);
    }

    return res.json(result);
  });
}
