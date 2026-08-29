import { Router } from "express";
import AdmZip from "adm-zip";
import axios from "axios";
import FormData from "form-data";

const router = Router();

// 1. Varianta de descărcare manuală (ZIP)
// URL format for SAGA: /api/saga-sync?cui=12345&month=8&year=2026
router.get("/", async (req, res) => {
  try {
    const { token, month, year, cui } = req.query;
    console.log("SAGA Sync request:", { query: req.query, headers: req.headers });
    
    // Simplă validare de securitate (temporar dezactivată pentru a vedea ce trimite SAGA)
    // if (token !== "saga2026") {
    //   return res.status(401).send("Unauthorized. Token invalid.");
    // }

    const exportMonth = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const exportYear = year ? parseInt(String(year)) : new Date().getFullYear();

    // Importăm dinamic pentru a nu încărca fișierul prematur
    const { generateSagaExportXML } = await import("./sagaXmlGenerator.js");
    
    // Extragem tenantId din URL, altfel default la 1
    const tenantId = req.query.tenantId ? parseInt(String(req.query.tenantId)) : 1;
    const xmlContent = await generateSagaExportXML(tenantId, exportMonth, exportYear);

    // Creăm arhiva ZIP folosind adm-zip
    const zip = new AdmZip();
    
    // API-ul și SAGA așteaptă Facturi sub forma F_CUI_NUMAR_DATA.xml
    // Dacă e un export bulk, F_CUI_LUNA_AN.xml e acceptat atâta timp cât are <Facturi>
    const safeCui = cui ? String(cui).trim() : "EXPORT";
    const fileName = `F_${safeCui}_${exportMonth}_${exportYear}.xml`;
    
    zip.addFile(fileName, Buffer.from(xmlContent, "utf8"));

    const zipBuffer = zip.toBuffer();

    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename=SAGA_Sync_${exportYear}_${exportMonth}.zip`);
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


// 2. Varianta de Push Automat (API SAGA Web)
router.post("/push", async (req, res) => {
  try {
    const { month, year, tenantId, sagaToken, sagaCui } = req.body;
    
    if (!sagaToken || !sagaCui) {
      return res.status(400).json({ success: false, message: "Missing sagaToken or sagaCui" });
    }

    const exportMonth = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const exportYear = year ? parseInt(String(year)) : new Date().getFullYear();
    const tId = tenantId ? parseInt(String(tenantId)) : 1;

    const { generateSagaExportXML } = await import("./sagaXmlGenerator.js");
    const xmlContent = await generateSagaExportXML(tId, exportMonth, exportYear);
    
    const fileName = `F_${sagaCui}_${exportMonth}_${exportYear}.xml`;

    const form = new FormData();
    form.append("file", Buffer.from(xmlContent, "utf8"), {
      filename: fileName,
      contentType: "application/xml",
    });

    // Trimitem direct către SAGA Web API
    const response = await axios.post("https://web.sagasoft.ro/api/v20260225/Import", form, {
      headers: {
        ...form.getHeaders(),
        "X-Saga-Cod-Fiscal": sagaCui,
        "Authorization": `Bearer ${sagaToken}`
      }
    });

    const newToken = response.headers["x-saga-refresh-token"];

    res.json({
      success: true,
      sagaResponse: response.data,
      newToken: newToken || null
    });

  } catch (err: any) {
    console.error("SAGA API Push Error:", err?.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      message: err.message, 
      sagaError: err?.response?.data 
    });
  }
});

export function registerSagaSyncRoute(app: import("express").Express) {
  app.use("/api/saga-sync", router);
}
