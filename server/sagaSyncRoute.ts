import { Router } from "express";
import AdmZip from "adm-zip";
import axios from "axios";
import FormData from "form-data";
import { format } from "date-fns";
import {
  generateSagaExportXML,
  generateSagaNirXML,
  generateSagaArticlesXML,
  generateSagaClientsXML,
  getTenantCompanyProfile,
  updateTenantSagaToken,
  toSagaXmlBuffer,
} from "./sagaXmlGenerator.js";
import { getDb } from "./db.js";
import * as schema from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { resolveRequestTenant } from "./fileAuth.js";

const router = Router();

/**
 * 1. Endpoint de descărcare fișiere / ZIP pentru SAGA C Desktop
 * Exemplu: /api/saga-sync?month=9&year=2026&tenantId=1
 * Parametri opționali:
 * - type: "zip" (implicit) | "facturi" | "nir" | "articole" | "clienti"
 * - nirId: ID-ul unui NIR specific pentru descărcare directă
 */
router.get("/", async (req, res) => {
  try {
    const { month, year, cui, type = "zip", nirId, nirIds, invoiceIds } = req.query;
    const tenantId = resolveRequestTenant(req, req.query.tenantId);

    const exportMonth = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const exportYear = year ? parseInt(String(year)) : new Date().getFullYear();

    const company = await getTenantCompanyProfile(tenantId);
    const safeCui =
      (cui ? String(cui).trim() : company.cui.replace(/^RO/i, ""))
        .replace(/[^a-zA-Z0-9_-]/g, "") || "EXPORT";
    const dateStr = format(new Date(), "ddMMyyyy");

    const parsedNirIds =
      nirIds !== undefined
        ? String(nirIds)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter((n) => !isNaN(n))
        : undefined;
    const parsedInvoiceIds =
      invoiceIds !== undefined
        ? String(invoiceIds)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter((n) => !isNaN(n))
        : undefined;

    if (type === "nir" || nirId) {
      const targetNirIds = parsedNirIds && parsedNirIds.length > 0 
        ? parsedNirIds 
        : (nirId ? parseInt(String(nirId)) : undefined);
      const xmlContent = await generateSagaNirXML(tenantId, targetNirIds, {
        month: month ? exportMonth : undefined,
        year: year ? exportYear : undefined,
      });
      let fileName = `F_${safeCui}_NIR_${exportMonth}_${exportYear}.xml`;
      if (typeof targetNirIds === "number") {
        fileName = `F_${safeCui}_NIR_${targetNirIds}.xml`;
      } else if (Array.isArray(targetNirIds)) {
        fileName = `F_${safeCui}_NIR_SEL_${targetNirIds.length}.xml`;
      } else if (!month && !year) {
        fileName = `F_${safeCui}_NIR_ALL.xml`;
      }
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(toSagaXmlBuffer(xmlContent));
    }

    if (type === "facturi") {
      const xmlContent = await generateSagaExportXML(tenantId, exportMonth, exportYear, {
        nirIds: parsedNirIds,
        invoiceIds: parsedInvoiceIds,
      });
      const fileName = exportMonth === 0 ? `F_${safeCui}_ALL_${exportYear}.xml` : `F_${safeCui}_${exportMonth}_${exportYear}.xml`;
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(toSagaXmlBuffer(xmlContent));
    }

    if (type === "articole") {
      const xmlContent = await generateSagaArticlesXML(tenantId);
      const fileName = `ART_${dateStr}.xml`;
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(toSagaXmlBuffer(xmlContent));
    }

    if (type === "clienti") {
      const xmlContent = await generateSagaClientsXML(tenantId);
      const fileName = `CLI_${dateStr}.xml`;
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(toSagaXmlBuffer(xmlContent));
    }

    // Implicit: Pachet complet ZIP (conform SAGA C Diverse > Import date)
    // SAGA C Import date citește din folder fișierele F_...xml, CLI_...xml, ART_...xml.
    // NU se adaugă fișiere duplicate (ex: FACTURI.XML + F_...xml) în aceeași arhivă,
    // deoarece SAGA C scanează directorul extras și importă ambele fișiere, provocând DUBLAREA documentelor!
    // În plus, în arhiva ZIP includem în CLI_ și ART_ STRICT partenerii și articolele referite efectiv
    // în xmlFacturi din perioada/selecția exportată, pentru a nu re-scana sau suprascrie tot nomenclatorul istoric!
    const xmlFacturi = await generateSagaExportXML(tenantId, exportMonth, exportYear, {
      nirIds: parsedNirIds,
      invoiceIds: parsedInvoiceIds,
    });

    const referencedArticleCodes = new Set<string>();
    for (const m of xmlFacturi.matchAll(/<Cod>(.*?)<\/Cod>/g)) {
      const c = m[1]?.trim();
      if (c) referencedArticleCodes.add(c);
    }
    const referencedClientCodes = new Set<string>();
    for (const m of xmlFacturi.matchAll(/<ClientCod>(.*?)<\/ClientCod>/g)) {
      const c = m[1]?.trim();
      if (c) referencedClientCodes.add(c);
    }

    const zip = new AdmZip();
    const facturiFileName = exportMonth === 0 ? `F_${safeCui}_ALL_${exportYear}.xml` : `F_${safeCui}_${exportMonth}_${exportYear}.xml`;
    zip.addFile(facturiFileName, toSagaXmlBuffer(xmlFacturi));

    if (referencedClientCodes.size > 0) {
      const xmlClienti = await generateSagaClientsXML(tenantId, { onlyCodes: referencedClientCodes });
      if (xmlClienti.includes("<Linie>")) {
        zip.addFile(`CLI_${dateStr}.xml`, toSagaXmlBuffer(xmlClienti));
      }
    }

    if (referencedArticleCodes.size > 0) {
      const xmlArticole = await generateSagaArticlesXML(tenantId, { onlyCodes: referencedArticleCodes });
      if (xmlArticole.includes("<Linie>")) {
        zip.addFile(`ART_${dateStr}.xml`, toSagaXmlBuffer(xmlArticole));
      }
    }

    const zipBuffer = zip.toBuffer();

    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="SAGA_Import_${safeCui}_${exportYear}_${exportMonth}.zip"`);
    res.set("Content-Length", zipBuffer.length.toString());
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    res.send(zipBuffer);
  } catch (err: any) {
    console.error("SAGA API Sync Error:", err);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});

/**
 * 2. Push Automat către SAGA Web API (https://web.sagasoft.ro/api/v20260225/Import)
 * Body: { month, year, tenantId, sagaToken?, sagaCui? }
 */
router.post("/push", async (req, res) => {
  try {
    if ((req as any).fileAuth?.role === "accountant" || !(req as any).fileAuth?.accountId) {
      return res.status(403).json({
        success: false,
        message: "Acces interzis (sesiune doar pentru citire).",
      });
    }
    const { month, year, tenantId = 1, sagaToken: inputToken, sagaCui: inputCui } = req.body;
    const tId = resolveRequestTenant(req, tenantId);

    const company = await getTenantCompanyProfile(tId);

    // Citim tokenul și cuiul din parametru sau din setările tenantului
    const usedStoredToken = !inputToken || !String(inputToken).trim() || String(inputToken).trim() === "••••••••";
    let sagaToken = usedStoredToken ? "" : String(inputToken).trim();
    let sagaCui = inputCui;

    if (!sagaToken || !sagaCui) {
      const db = await getDb();
      if (db) {
        const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tId));
        if (tenant?.settings) {
          try {
            const s = JSON.parse(tenant.settings);
            if (!sagaToken) sagaToken = s.sagaWebToken;
            if (!sagaCui) sagaCui = s.sagaWebCui || tenant.cui?.replace(/^RO/i, "");
          } catch {
            // ignore
          }
        }
      }
    }

    if (!sagaCui) {
      sagaCui = company.cui.replace(/^RO/i, "").trim();
    }
    sagaCui = String(sagaCui || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sagaCui) {
      return res.status(400).json({
        success: false,
        message: "CUI-ul pentru SAGA Web lipsește sau este invalid.",
      });
    }

    if (!sagaToken) {
      return res.status(400).json({
        success: false,
        message: "Lipsește cheia de acces SAGA Web (token). O poți genera din Saga Web: Administrare > Utilizatori > Integrare API.",
      });
    }

    const exportMonth = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const exportYear = year ? parseInt(String(year)) : new Date().getFullYear();

    const xmlContent = await generateSagaExportXML(tId, exportMonth, exportYear);
    const fileName = `F_${sagaCui}_${exportMonth}_${exportYear}.xml`;

    const form = new FormData();
    form.append("file", toSagaXmlBuffer(xmlContent), {
      filename: fileName,
      contentType: "application/xml; charset=windows-1250",
    });

    console.log(`[SAGA WEB API] Se trimite ${fileName} către SAGA Web API (CUI: ${sagaCui})...`);

    const response = await axios.post("https://web.sagasoft.ro/api/v20260225/Import", form, {
      headers: {
        ...form.getHeaders(),
        "X-Saga-Cod-Fiscal": sagaCui,
        Authorization: `Bearer ${sagaToken}`,
      },
      timeout: 30000,
    });

    // IMPORTANT: Salvăm noul refresh token DOAR când am folosit token-ul stocat al tenantului
    const newToken = response.headers["x-saga-refresh-token"];
    if (newToken && usedStoredToken) {
      console.log("[SAGA WEB API] S-a primit un nou refresh token. Se salvează automat în baza de date...");
      await updateTenantSagaToken(tId, newToken);
    }

    res.json({
      success: true,
      message: response.data?.message || "Import realizat cu succes în SAGA Web!",
      sagaResponse: response.data,
      newToken: newToken || null,
    });
  } catch (err: any) {
    console.error("[SAGA WEB API ERROR]:", err?.response?.data || err.message);
    const errorMessage =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err.message ||
      "Eroare la comunicarea cu SAGA Web API";

    res.status(err?.response?.status || 500).json({
      success: false,
      message: errorMessage,
      sagaError: err?.response?.data,
    });
  }
});

/**
 * 3. Push Nomenclator Articole către SAGA Web API
 */
router.post("/push-articles", async (req, res) => {
  try {
    if ((req as any).fileAuth?.role === "accountant" || !(req as any).fileAuth?.accountId) {
      return res.status(403).json({
        success: false,
        message: "Acces interzis (sesiune doar pentru citire).",
      });
    }
    const { tenantId = 1, sagaToken: inputToken, sagaCui: inputCui } = req.body;
    const tId = resolveRequestTenant(req, tenantId);

    const company = await getTenantCompanyProfile(tId);
    const usedStoredToken = !inputToken || !String(inputToken).trim() || String(inputToken).trim() === "••••••••";
    let sagaToken = usedStoredToken ? "" : String(inputToken).trim();
    let sagaCui = String(inputCui || company.cui.replace(/^RO/i, "").trim()).replace(/[^a-zA-Z0-9_-]/g, "");

    if (!sagaToken) {
      const db = await getDb();
      if (db) {
        const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tId));
        if (tenant?.settings) {
          try {
            const s = JSON.parse(tenant.settings);
            sagaToken = s.sagaWebToken;
            if (!sagaCui && s.sagaWebCui) {
              sagaCui = String(s.sagaWebCui).replace(/[^a-zA-Z0-9_-]/g, "");
            }
          } catch {}
        }
      }
    }

    if (!sagaCui) {
      return res.status(400).json({ success: false, message: "CUI-ul pentru SAGA Web lipsește sau este invalid." });
    }
    if (!sagaToken) {
      return res.status(400).json({ success: false, message: "Lipsește token-ul SAGA Web." });
    }

    const xmlContent = await generateSagaArticlesXML(tId);
    const dateStr = format(new Date(), "ddMMyyyy");
    const fileName = `ART_${dateStr}.xml`;

    const form = new FormData();
    form.append("file", toSagaXmlBuffer(xmlContent), {
      filename: fileName,
      contentType: "application/xml; charset=windows-1250",
    });

    const response = await axios.post("https://web.sagasoft.ro/api/v20260225/Import", form, {
      headers: {
        ...form.getHeaders(),
        "X-Saga-Cod-Fiscal": sagaCui,
        Authorization: `Bearer ${sagaToken}`,
      },
      timeout: 30000,
    });

    const newToken = response.headers["x-saga-refresh-token"];
    if (newToken && usedStoredToken) {
      await updateTenantSagaToken(tId, newToken);
    }

    res.json({
      success: true,
      message: response.data?.message || "Nomenclatorul de articole a fost importat cu succes în SAGA Web!",
      sagaResponse: response.data,
      newToken: newToken || null,
    });
  } catch (err: any) {
    console.error("[SAGA WEB API ARTICOLE ERROR]:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err?.response?.data?.error || err.message,
    });
  }
});

export function registerSagaSyncRoute(app: import("express").Express) {
  app.use("/api/saga-sync", router);
}
