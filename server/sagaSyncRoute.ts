import { Router } from "express";
import AdmZip from "adm-zip";

const router = Router();

// SAGA calls this endpoint to pull the XML files bundled in a ZIP archive.
// URL format for SAGA: /api/saga-sync?token=saga2026
router.get("/", async (req, res) => {
  try {
    const { token, month, year } = req.query;
    console.log("SAGA Sync request:", { query: req.query, headers: req.headers });
    
    // Simplă validare de securitate (temporar dezactivată pentru a vedea ce trimite SAGA)
    // if (token !== "saga2026") {
    //   return res.status(401).send("Unauthorized. Token invalid.");
    // }

    const exportMonth = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const exportYear = year ? parseInt(String(year)) : new Date().getFullYear();

    // Importăm dinamic pentru a nu încărca fișierul prematur
    const { generateSagaExportXML } = await import("./sagaXmlGenerator.js");
    
    // Găsim exportul pentru tenant-ul 1 (implicit)
    const xmlContent = await generateSagaExportXML(1, exportMonth, exportYear);

    // Creăm arhiva ZIP folosind adm-zip (SAGA necesită arhiva)
    const zip = new AdmZip();
    
    // API-ul SAGA necesită fișiere separate, nu un ExportSaga global
    const intrariMatch = xmlContent.match(/<Intrari>[\s\S]*?<\/Intrari>/);
    if (intrariMatch) {
      zip.addFile("Intrari.xml", Buffer.from(`<?xml version="1.0" encoding="Windows-1250"?>\n${intrariMatch[0]}`, "utf8"));
    }

    const iesiriMatch = xmlContent.match(/<Iesiri>[\s\S]*?<\/Iesiri>/);
    if (iesiriMatch) {
      zip.addFile("Facturi.xml", Buffer.from(`<?xml version="1.0" encoding="Windows-1250"?>\n${iesiriMatch[0]}`, "utf8"));
    }

    const clientiMatch = xmlContent.match(/<Clienti>[\s\S]*?<\/Clienti>/);
    if (clientiMatch) {
      zip.addFile("Clienti.xml", Buffer.from(`<?xml version="1.0" encoding="Windows-1250"?>\n${clientiMatch[0]}`, "utf8"));
    }

    // Fallback: dacă nu e nimic, punem un XML gol ca să nu crape cu fișier inexistent
    if (!intrariMatch && !iesiriMatch && !clientiMatch) {
      zip.addFile("Intrari.xml", Buffer.from(`<?xml version="1.0" encoding="Windows-1250"?>\n<Intrari></Intrari>`, "utf8"));
    }

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

export function registerSagaSyncRoute(app: import("express").Express) {
  app.use("/api/saga-sync", router);
}
