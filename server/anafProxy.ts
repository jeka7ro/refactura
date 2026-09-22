/**
 * Proxy ANAF - evită CORS pentru lookup CUI
 * GET /api/anaf/:cui  → returnează date firmă
 */
import type { Express } from "express";
import { fetchViesData } from "./viesProxy";

export function registerAnafProxy(app: Express) {
  app.get("/api/anaf/:cui", async (req, res) => {
    const { cui } = req.params;
    const trimmed = (cui || "").trim().replace(/\s/g, "");

    // Dacă CUI începe cu un prefix de țară UE diferit de RO (ex: BE0785292895, DE123456789, IE6388047V)
    const euPrefixMatch = trimmed.match(/^([A-Za-z]{2})(.*)$/);
    if (euPrefixMatch && euPrefixMatch[1].toUpperCase() !== "RO") {
      const viesRes = await fetchViesData(euPrefixMatch[1], euPrefixMatch[2]);
      if (!viesRes.valid) {
        return res.status(404).json(viesRes);
      }
      return res.json(viesRes);
    }

    const cuiNum = trimmed.replace(/^ro/i, "");

    if (!cuiNum || !/^\d{2,10}$/.test(cuiNum)) {
      return res.status(400).json({ error: "CUI invalid" });
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      const anafRes = await fetch(
        "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ cui: parseInt(cuiNum), data: today }]),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!anafRes.ok) {
        return res.status(502).json({ error: "ANAF indisponibil" });
      }

      const data = await anafRes.json();
      const found = data?.found?.[0];

      if (!found) {
        return res.status(404).json({ error: "CUI negăsit" });
      }

      // v9 - date_generale conține info firmă, adresa_sediu_social e la nivel top found[0]
      const dg = found.date_generale || found;
      const adresaSediu = found.adresa_sediu_social;

      // Adresă completă din ANAF
      const adresa =
        dg.adresa ||
        [adresaSediu?.sdenumire_Strada, adresaSediu?.snumar_Strada]
          .filter(Boolean)
          .join(" ") ||
        "";

      // Localitate / județ
      const judet =
        adresaSediu?.sdenumire_Localitate ||
        adresaSediu?.sdenumire_Judet ||
        dg.judet ||
        "";

      return res.json({
        cui: dg.cui,
        denumire: dg.denumire || "",
        adresa,
        judet,
        oras: adresaSediu?.sdenumire_Localitate || "",
        nrRegCom: dg.nrRegCom || "",
        tva: found.inregistrare_scop_Tva?.scpTVA === true,
        telefon: dg.telefon || "",
        codPostal: dg.codPostal || adresaSediu?.scod_Postal || "",
        activ: found.stare_inactiv?.statusInactivi !== true,
      });
    } catch (err: any) {
      console.error("[ANAF Proxy] Error:", err.message);
      return res.status(502).json({ error: "Nu s-a putut contacta ANAF" });
    }
  });
}
