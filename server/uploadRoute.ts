import { Express, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(pdf|xml)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Doar fișiere PDF și XML sunt acceptate"));
    }
  },
});

// SAGA XLSX import — accepts .xlsx/.xls/.csv
const sagaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 }, // 32MB for large article lists
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Doar fișiere XLSX, XLS sau CSV sunt acceptate"));
    }
  },
});

// SAGA Invoice import — accepts .xml/.xlsx/.xls/.csv
const sagaInvoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(xml|xlsx|xls|csv)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Doar fișiere XML, XLSX, XLS sau CSV sunt acceptate"));
    }
  },
});

// SAGA FACTURI EXTERNE Import Route
export function attachSagaInvoicesImportRoute(app: Express) {
  app.post(
    "/api/saga/import-invoices",
    sagaInvoiceUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const tenantIdStr = req.body.tenantId;
        if (!file) return res.status(400).json({ error: "Niciun fișier primit." });

        const tenantId = tenantIdStr ? parseInt(tenantIdStr, 10) : 1;
        const ext = path.extname(file.originalname).toLowerCase();

        const {
          parseSagaXmlInvoices,
          parseSagaXlsxInvoices,
          saveSagaInvoicesToDb,
        } = await import("./sagaInvoiceImporter");

        let parsedInvoices = [];
        if (ext === ".xml") {
          parsedInvoices = parseSagaXmlInvoices(file.buffer);
        } else if ([".xlsx", ".xls", ".csv"].includes(ext)) {
          parsedInvoices = parseSagaXlsxInvoices(file.buffer);
        } else {
          return res.status(400).json({ error: "Format neacceptat. Încărcați XML sau Excel." });
        }

        if (parsedInvoices.length === 0) {
          return res.status(400).json({ error: "Nu a fost găsită nicio factură în fișier." });
        }

        const result = await saveSagaInvoicesToDb(tenantId, parsedInvoices);
        return res.json({
          success: true,
          ...result,
          message: `${result.imported} facturi externe importate cu succes (${result.skipped} omise/deja existente).`,
        });
      } catch (err: any) {
        console.error("[SAGA Import Invoices] Error:", err);
        return res.status(500).json({ error: err.message || "Eroare la importul facturilor SAGA." });
      }
    }
  );
}

// SAGA FURNIZORI (Suppliers) XLSX Import Route
export function attachSagaFurnizoriImportRoute(app: Express) {
  app.post(
    "/api/saga/import-furnizori",
    sagaUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const tenantIdStr = req.body.tenantId;
        const XLSX = await import("xlsx");
        const { getDb } = await import("./db");
        const { sagaFurnizori } = await import("../modules/saga/schema");
        const db = await getDb();

        if (!file) return res.status(400).json({ error: "Missing file" });
        if (!db) return res.status(500).json({ error: "DB unavailable" });

        // Fallback for missing tenantId in test environments
        const tenantId = tenantIdStr ? parseInt(tenantIdStr, 10) : 1;

        console.log(`[SAGA Import Furnizori] Processing file for tenant ${tenantId}`);

        // Read XLSX
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        let imported = 0;
        let skipped = 0;
        const batchSize = 100;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = [];

          for (const row of batch) {
            const cod = String(row.COD || row.Cod || row.cod || "").trim();
            const denumire = String(row.DENUMIRE || row.Denumire || row.denumire || "").trim();
            if (!cod || !denumire) { skipped++; continue; }

            const cui = String(row.COD_FISCAL || row.Cui || row.cui || "").trim();
            const regCom = String(row.REG_COM || row.Reg_com || "").trim();
            const adresa = String(row.ADRESA || row.Adresa || "").trim();
            const judet = String(row.JUDET || row.Judet || "").trim();
            const localitate = String(row.LOCALITATE || row.Localitate || "").trim();
            const telefon = String(row.TELEFON || row.Telefon || "").trim();
            const email = String(row.EMAIL || row.Email || "").trim();
            const banca = String(row.BANCA || row.Banca || "").trim();
            const contBanca = String(row.CONT_BANCA || row.Cont_banca || "").trim();
            const contFurnizor = String(row.CONT_ANALITIC || row.Cont || "401").trim();

            values.push({
              tenantId,
              cod: cod,
              denumire: denumire,
              cui: cui || null,
              regCom: regCom || null,
              adresa: adresa || null,
              judet: judet || null,
              localitate: localitate || null,
              telefon: telefon || null,
              email: email || null,
              banca: banca || null,
              contBanca: contBanca || null,
              contFurnizor: contFurnizor || "401",
              isActive: 1,
            });
          }

          if (values.length > 0) {
            try {
              // Bulk insert ignore
              await db.insert(sagaFurnizori)
                .values(values)
                .onDuplicateKeyUpdate({
                   set: { denumire: sql`VALUES(denumire)` }
                });
              imported += values.length;
            } catch (e: any) {
              console.warn("[SAGA Import Furnizori] Batch insert error, skipping batch:", e.message);
              skipped += values.length;
            }
          }
        }

        console.log(`[SAGA Import Furnizori] Done: ${imported} imported, ${skipped} skipped, total rows: ${rows.length}`);
        return res.json({ success: true, imported, skipped, total: rows.length });
      } catch (err: any) {
        console.error("[SAGA Import Furnizori] Error:", err);
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

export function registerUploadRoute(app: Express) {
  app.post(
    "/api/upload-invoice",
    upload.array("file", 20),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "Niciun fișier primit" });
          return;
        }

        const results = [];
        for (const file of files) {
          const ext =
            file.originalname.split(".").pop()?.toLowerCase() || "bin";
          const key = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const uploadDir = path.join(
            process.cwd(),
            "dist",
            "public",
            "uploads",
            "invoices"
          );

          await fs.promises
            .mkdir(uploadDir, { recursive: true })
            .catch(() => {});

          const filePath = path.join(uploadDir, key);
          await fs.promises.writeFile(filePath, file.buffer);

          const fileUrl = `/uploads/invoices/${key}`;
          results.push({
            fileKey: key,
            fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
          });
        }

        if (results.length === 1) {
          res.json(results[0]);
          return;
        }
        res.json(results);
      } catch (err: any) {
        console.error("Upload error:", err);
        res.status(500).json({ error: err.message || "Eroare la upload" });
      }
    }
  );

  // ── SAGA XLSX Import ─────────────────────────────────────────────────────
  app.post(
    "/api/saga/import-articles",
    sagaUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: "Niciun fișier primit" });
          return;
        }

        // tenantId from query or body
        const tenantId = parseInt(req.body.tenantId || req.query.tenantId as string);
        if (!tenantId) {
          res.status(400).json({ error: "tenantId lipsă" });
          return;
        }

        // Parse XLSX
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows.length) {
          res.status(400).json({ error: "Fișierul este gol" });
          return;
        }

        // Map SAGA Desktop columns to our schema
        // SAGA columns: COD, DENUMIRE, UM, TVA, DEN_TIP, STOC, GRUPA, TIP, COD_BARE
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) {
          res.status(500).json({ error: "DB unavailable" });
          return;
        }

        // Map DEN_TIP/TIP to accounting account
        const tipToAccount: Record<string, string> = {
          "02": "301",   // Materii prime
          "03": "3028",  // Materiale auxiliare
          "04": "345",   // Produse finite
          "05": "341",   // Semifabricate
          "06": "303",   // Obiecte de inventar
          "07": "371",   // Mărfuri
          "08": "381",   // Ambalaje
          "15": "302",   // Piese de schimb
          "16": "3028",  // Alte mat. consumabile
        };

        const { sagaArticles } = await import("../modules/saga/schema");
        const { eq, and } = await import("drizzle-orm");

        let imported = 0;
        let skipped = 0;
        const batchSize = 100;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = [];

          for (const row of batch) {
            const cod = String(row.COD || row.Cod || row.cod || "").trim();
            const denumire = String(row.DENUMIRE || row.Denumire || row.denumire || "").trim();
            if (!cod || !denumire) { skipped++; continue; }

            const um = String(row.UM || row.Um || row.um || "buc").trim();
            const tva = String(row.TVA || row.Tva || row.tva || "19").trim();
            const denTip = String(row.DEN_TIP || row.Den_tip || "Marfuri").trim();
            const tipCod = String(row.TIP || row.Tip || row.tip || "07").trim().padStart(2, "0");
            const codBare = String(row.COD_BARE || row.Cod_bare || "").trim();

            const account = tipToAccount[tipCod] || "371";

            values.push({
              tenantId,
              code: cod,
              name: denumire,
              unit: um || "buc",
              vatRate: tva,
              category: denTip || "Marfuri",
              accountingAccount: account,
              sagaCode: cod,
              barcode: codBare || null,
              isActive: 1,
            });
          }

          if (values.length > 0) {
            try {
              // Bulk insert ignore (Drizzle MySQL syntax for IGNORE)
              await db.insert(sagaArticles)
                .values(values)
                .onDuplicateKeyUpdate({
                   set: { name: sql`VALUES(name)` } // dummy update to avoid throw
                });
              imported += values.length;
            } catch (e: any) {
              console.warn("[SAGA Import] Batch insert error, skipping batch:", e.message);
              skipped += values.length;
            }
          }
        }

        console.log(`[SAGA Import] Done: ${imported} imported, ${skipped} skipped, total rows: ${rows.length}`);
        res.json({ ok: true, imported, skipped, total: rows.length });
      } catch (err: any) {
        console.error("[SAGA Import] Error:", err);
        res.status(500).json({ error: err.message || "Eroare la import" });
      }
    }
  );
}

