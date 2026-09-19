import { Router } from "express";
import AdmZip from "adm-zip";
import axios from "axios";
import FormData from "form-data";
import { format } from "date-fns";
import {
  generateSagaExportXML,
  generateSagaArticlesXML,
  generateSagaClientsXML,
  getTenantCompanyProfile,
  updateTenantSagaToken,
} from "./sagaXmlGenerator.js";
import { getDb } from "./db.js";
import * as schema from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * 1. Endpoint de descărcare fișiere / ZIP pentru SAGA C Desktop
 * Exemplu: /api/saga-sync?month=9&year=2026&tenantId=1
 * Parametri opționali:
 * - type: "zip" (implicit) | "facturi" | "articole" | "clienti"
 */
router.get("/", async (req, res) => {
  try {
    const { month, year, cui, type = "zip" } = req.query;
    const tenantId = req.query.tenantId ? parseInt(String(req.query.tenantId)) : 1;

    const exportMonth = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const exportYear = year ? parseInt(String(year)) : new Date().getFullYear();

    const company = await getTenantCompanyProfile(tenantId);
    const safeCui = (cui ? String(cui).trim() : company.cui.replace(/^RO/i, "")).trim() || "EXPORT";
    const dateStr = format(new Date(), "ddMMyyyy");

    if (type === "facturi") {
      const xmlContent = await generateSagaExportXML(tenantId, exportMonth, exportYear);
      const fileName = `FACTURI.XML`;
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(Buffer.from(xmlContent, "utf8"));
    }

    if (type === "articole") {
      const xmlContent = await generateSagaArticlesXML(tenantId);
      const fileName = `ARTICOLE.XML`;
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(Buffer.from(xmlContent, "utf8"));
    }

    if (type === "clienti") {
      const xmlContent = await generateSagaClientsXML(tenantId);
      const fileName = `CLIENTI.XML`;
      res.set("Content-Type", "application/xml; charset=windows-1250");
      res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(Buffer.from(xmlContent, "utf8"));
    }

    // Implicit: Pachet complet ZIP (conform SAGA C Diverse > Import date)
    const xmlFacturi = await generateSagaExportXML(tenantId, exportMonth, exportYear);
    const xmlArticole = await generateSagaArticlesXML(tenantId);
    const xmlClienti = await generateSagaClientsXML(tenantId);

    const zip = new AdmZip();
    // Nume standard recunoscute instant de ecranul "Import date" din SAGA C
    zip.addFile(`FACTURI.XML`, Buffer.from(xmlFacturi, "utf8"));
    zip.addFile(`CLIENTI.XML`, Buffer.from(xmlClienti, "utf8"));
    zip.addFile(`ARTICOLE.XML`, Buffer.from(xmlArticole, "utf8"));
    // Păstrăm și denumirile alternative cu CUI și dată
    zip.addFile(`F_${safeCui}_${exportMonth}_${exportYear}.xml`, Buffer.from(xmlFacturi, "utf8"));
    zip.addFile(`ART_${dateStr}.xml`, Buffer.from(xmlArticole, "utf8"));
    zip.addFile(`CLI_${dateStr}.xml`, Buffer.from(xmlClienti, "utf8"));

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
    const { month, year, tenantId = 1, sagaToken: inputToken, sagaCui: inputCui } = req.body;
    const tId = parseInt(String(tenantId)) || 1;

    const company = await getTenantCompanyProfile(tId);

    // Citim tokenul și cuiul din parametru sau din setările tenantului
    let sagaToken = inputToken;
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
    form.append("file", Buffer.from(xmlContent, "utf8"), {
      filename: fileName,
      contentType: "application/xml",
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

    // IMPORTANT: Verificăm headerul X-Saga-Refresh-Token
    const newToken = response.headers["x-saga-refresh-token"];
    if (newToken) {
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
    const { tenantId = 1, sagaToken: inputToken, sagaCui: inputCui } = req.body;
    const tId = parseInt(String(tenantId)) || 1;

    const company = await getTenantCompanyProfile(tId);
    let sagaToken = inputToken;
    let sagaCui = inputCui || company.cui.replace(/^RO/i, "").trim();

    if (!sagaToken) {
      const db = await getDb();
      if (db) {
        const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tId));
        if (tenant?.settings) {
          try {
            const s = JSON.parse(tenant.settings);
            sagaToken = s.sagaWebToken;
          } catch {}
        }
      }
    }

    if (!sagaToken) {
      return res.status(400).json({ success: false, message: "Lipsește token-ul SAGA Web." });
    }

    const xmlContent = await generateSagaArticlesXML(tId);
    const dateStr = format(new Date(), "ddMMyyyy");
    const fileName = `ART_${dateStr}.xml`;

    const form = new FormData();
    form.append("file", Buffer.from(xmlContent, "utf8"), {
      filename: fileName,
      contentType: "application/xml",
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
    if (newToken) {
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
