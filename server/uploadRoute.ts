import { Express, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import AdmZip from "adm-zip";
import { sql } from "drizzle-orm";
import { resolveRequestTenant } from "./fileAuth";

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

const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(pdf|docx|doc|xml)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Sunt acceptate doar fișiere PDF sau Word (.docx / .doc)"));
    }
  },
});

function parsePdfToUnicodeCmap(s: string): Map<number, string> {
  const cmap = new Map<number, string>();
  const charBlocks = s.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const b of charBlocks) {
    const pairs = b.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
    for (const p of pairs) {
      const m = p.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (m) {
        const src = parseInt(m[1], 16);
        const dstHex = m[2];
        let str = "";
        for (let i = 0; i < dstHex.length; i += 4) {
          str += String.fromCharCode(parseInt(dstHex.slice(i, i + 4), 16));
        }
        cmap.set(src, str);
      }
    }
  }
  const rangeBlocks = s.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const b of rangeBlocks) {
    const lines = b.split(/[\r\n]+/);
    for (const line of lines) {
      const arrMatch = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/);
      if (arrMatch) {
        const start = parseInt(arrMatch[1], 16);
        const end = parseInt(arrMatch[2], 16);
        const hexes = (arrMatch[3].match(/<([0-9A-Fa-f]+)>/g) || []).map((h) =>
          parseInt(h.slice(1, -1), 16)
        );
        for (let code = start, idx = 0; code <= end && idx < hexes.length; code++, idx++) {
          cmap.set(code, String.fromCharCode(hexes[idx]));
        }
        continue;
      }
      const m = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (m) {
        const start = parseInt(m[1], 16);
        const end = parseInt(m[2], 16);
        let dst = parseInt(m[3], 16);
        for (let code = start; code <= end; code++) {
          cmap.set(code, String.fromCharCode(dst++));
        }
      }
    }
  }
  return cmap;
}

function extractContractTextAndHtml(buf: Buffer, originalName: string): { text: string; html: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === ".docx") {
    try {
      const zip = new AdmZip(buf);
      const entry = zip.getEntry("word/document.xml");
      if (entry) {
        const xml = entry.getData().toString("utf8");
        const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
        const lines: string[] = [];
        const htmlParts: string[] = [];
        for (const p of paragraphs) {
          const texts = (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, ""))
            .join("");
          const clean = texts
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
          if (clean) {
            lines.push(clean);
            if (/^(?:CONTRACT|PĂRȚILE|PARTILE|[A-I]\.\s+[A-ZĂÂÎȘȚ])/i.test(clean)) {
              htmlParts.push(`<h3 style="font-size:13px;font-weight:bold;margin:12px 0 6px 0;">${clean}</h3>`);
            } else {
              htmlParts.push(`<p style="font-size:12px;margin:4px 0;line-height:1.5;">${clean}</p>`);
            }
          }
        }
        return { text: lines.join("\n"), html: htmlParts.join("\n") };
      }
    } catch (e) {
      console.warn("[Contract Upload] DOCX parse warning:", e);
    }
  }

  if (ext === ".pdf") {
    try {
      const raw = buf.toString("latin1");
      const globalCmap = new Map<number, string>();
      const contentStreams: string[] = [];
      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let sm: RegExpExecArray | null;
      while ((sm = streamRegex.exec(raw)) !== null) {
        let dec: string | null = null;
        const bytes = Buffer.from(sm[1], "latin1");
        try {
          dec = zlib.inflateSync(bytes).toString("latin1");
        } catch {
          try {
            dec = zlib.inflateRawSync(bytes).toString("latin1");
          } catch {
            dec = sm[1];
          }
        }
        if (dec) {
          if (dec.includes("beginbfchar") || dec.includes("beginbfrange")) {
            const cm = parsePdfToUnicodeCmap(dec);
            cm.forEach((v, k) => {
              if (!globalCmap.has(k)) globalCmap.set(k, v);
            });
          } else if (dec.includes("BT") && dec.includes("ET")) {
            contentStreams.push(dec);
          }
        }
      }

      const decodeHex = (hex: string) => {
        let out = "";
        const step = hex.length % 4 === 0 ? 4 : 2;
        for (let i = 0; i < hex.length; i += step) {
          const code = parseInt(hex.slice(i, i + step), 16);
          if (globalCmap.has(code)) out += globalCmap.get(code);
          else if (code >= 32 && code <= 126) out += String.fromCharCode(code);
        }
        return out;
      };

      let fullText = "";
      for (const s of contentStreams) {
        const cleaned = s.replace(/\/Lang\s*\([^)]*\)/g, "");
        const btBlocks = cleaned.match(/BT[\s\S]*?ET/g) || [];
        for (const block of btBlocks) {
          const tokenRegex = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f]+>/g;
          let tok: RegExpExecArray | null;
          let blockText = "";
          while ((tok = tokenRegex.exec(block)) !== null) {
            const t = tok[0];
            if (t.startsWith("(")) {
              blockText += t.slice(1, -1).replace(/\\([()\\])/g, "$1");
            } else if (t.startsWith("<")) {
              blockText += decodeHex(t.slice(1, -1));
            }
          }
          fullText += blockText;
        }
      }

      const normalized = fullText.replace(/\s+/g, " ").trim();
      if (normalized) {
        // Structure extracted text into readable HTML paragraphs around section headers & numbered clauses
        const structured = normalized
          .replace(/\s+(PĂRȚILE CONTRACTANTE|[A-I]\.\s+[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s.]+|FURNIZOR\s+S\.C\.)/g, "\n\n$1\n")
          .replace(/\s+(\d{1,2}\.\s+[A-ZĂÂÎȘȚ])/g, "\n$1");
        const html = structured
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) =>
            /^(?:CONTRACT|PĂRȚILE|[A-I]\.\s+)/i.test(line)
              ? `<h3 style="font-size:13px;font-weight:bold;margin:12px 0 6px 0;">${line}</h3>`
              : `<p style="font-size:12px;margin:4px 0;line-height:1.5;">${line}</p>`
          )
          .join("\n");
        return { text: normalized, html };
      }
    } catch (e) {
      console.warn("[Contract Upload] PDF parse warning:", e);
    }
  }

  return { text: "", html: "" };
}

function parseContractMetadata(text: string, fileName: string) {
  // 1. Contract Number
  let detectedNumber: string | null = null;
  const textNumMatch = text.match(
    /(?:CONTRACT|ACT\s+ADI[TȚ]IONAL)[^0-9]{0,25}?(?:Nr\.?|No\.?)\s*([0-9]+(?:[\/-][0-9A-Za-z]+)?)/i
  );
  if (textNumMatch) {
    detectedNumber = textNumMatch[1].trim();
  }
  if (!detectedNumber) {
    const fnNumMatch =
      fileName.match(/(?:nr|no)[\s._-]*([0-9]+[a-zA-Z0-9\/-]*)/i) ||
      fileName.match(/(?:ctr|contract)[\s._-]*(?:nr\.?|no\.?)?[\s._-]*([0-9]+[a-zA-Z0-9\/-]*)/i);
    if (fnNumMatch) detectedNumber = fnNumMatch[1].trim();
  }

  // 2. Contract Date (YYYY-MM-DD)
  let detectedDate: string | null = null;
  const dateMatch = text.match(
    /(?:din\s+data\s+de|data\s+de|dated|data\s+încheierii)[\s:]*([0-3]?\d)\s*[.\/-]\s*([01]?\d)\s*[.\/-]\s*(20\d{2})/i
  );
  if (dateMatch) {
    detectedDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  }

  // 3. Value & Currency
  let detectedValue: string | null = null;
  let detectedCurrency: string | null = null;
  const valMatch = text.match(
    /(?:valoarea[^0-9]{0,80}?este\s+de|pre[tț]ul[^0-9]{0,80}?este\s+de|valoare\s+total[aă][^0-9]{0,30}?)\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\s*(EUR|EURO|RON|LEI|USD)/i
  );
  if (valMatch) {
    const rawVal = valMatch[1].replace(/\s+/g, "");
    detectedValue = rawVal.includes(",")
      ? rawVal.replace(/\./g, "").replace(",", ".")
      : rawVal;
    const rawCur = valMatch[2].toUpperCase();
    detectedCurrency = rawCur === "EURO" ? "EUR" : rawCur === "LEI" ? "RON" : rawCur;
  }

  // 4. Partner Name
  let detectedPartnerName: string | null = null;
  const party2Match = text.match(
    /2\.\s*([A-ZĂÂÎȘȚ0-9][A-ZĂÂÎȘȚa-zăâîșț0-9\s.&+–-]{2,65}?)\s*,\s*cu\s+(?:sediul|domiciliul)/i
  );
  if (party2Match) {
    detectedPartnerName = party2Match[1].replace(/\s+/g, " ").trim();
  } else {
    const fnPartner = fileName
      .replace(/\.(pdf|docx|doc|xml)$/i, "")
      .replace(/^(?:contract|ctr)[\s._-]*(?:nr\.?|no\.?)?[\s._-]*[0-9a-zA-Z\/-]+[\s._-]*/i, "")
      .replace(/^(?:externe[\s._-]*engleza|interne)[\s._-]*/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    if (fnPartner.length >= 3) detectedPartnerName = fnPartner;
  }

  // 5. Partner CUI / VAT (excluding supplier CUIs 28396216 and 42322117)
  let detectedCui: string | null = null;
  const vatRegex = /(?:VAT\s*nr\.?|CUI\/CIF|CUI|CIF)[\s:]*([A-Z]{2}\s*[0-9A-Z]{6,12}|RO\s*[0-9]{6,10}|[0-9]{6,10})/gi;
  let vm: RegExpExecArray | null;
  while ((vm = vatRegex.exec(text)) !== null) {
    const candidate = vm[1].replace(/\s+/g, "").toUpperCase();
    if (!candidate.includes("28396216") && !candidate.includes("42322117")) {
      detectedCui = candidate;
      break;
    }
  }
  if (!detectedCui) {
    const fnCuiMatch = fileName.match(/(?:RO|ro)\s*([0-9]{6,10})/);
    if (fnCuiMatch && !fnCuiMatch[1].includes("28396216")) {
      detectedCui = `RO${fnCuiMatch[1]}`;
    }
  }

  // 6. Wood Glass specific metadata (Offer number, Offer date, Wood essence)
  let detectedOfferNumber: string | null = null;
  let detectedOfferDate: string | null = null;
  const offerMatch = text.match(
    /Ofertei\s+de\s+pre[tț]\s*(?:nr\.?)?\s*([A-Za-z0-9\s-]+?)\s*\/\s*([0-3]?\d\.[01]?\d\.20\d{2})/i
  );
  if (offerMatch) {
    detectedOfferNumber = offerMatch[1].trim();
    detectedOfferDate = offerMatch[2].trim();
  }

  let detectedWoodEssence: string | null = null;
  const essenceMatch = text.match(/esen[tț][aă]\s+([A-Za-zĂÂÎȘȚăâîșț0-9\s]+?mm)/i);
  if (essenceMatch) {
    detectedWoodEssence = essenceMatch[1].replace(/\s+/g, " ").trim();
  }

  return {
    detectedNumber,
    detectedDate,
    detectedValue,
    detectedCurrency,
    detectedPartnerName,
    detectedCui,
    detectedOfferNumber,
    detectedOfferDate,
    detectedWoodEssence,
  };
}

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

        const tenantId = resolveRequestTenant(req, tenantIdStr);
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
        const tenantId = resolveRequestTenant(req, tenantIdStr);

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

// SAGA CLIENȚI (Clients) XLSX Import Route
export function attachSagaClientiImportRoute(app: Express) {
  app.post(
    "/api/saga/import-clienti",
    sagaUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const tenantIdStr = req.body.tenantId;
        const XLSX = await import("xlsx");
        const { getDb } = await import("./db");
        const { clients } = await import("../drizzle/schema");
        const { eq, and, sql } = await import("drizzle-orm");
        const db = await getDb();

        if (!file) return res.status(400).json({ error: "Missing file" });
        if (!db) return res.status(500).json({ error: "DB unavailable" });

        const tenantId = resolveRequestTenant(req, tenantIdStr);
        console.log(`[SAGA Import Clienti] Processing file for tenant ${tenantId}`);

        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const row of rows) {
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

          // Căutăm dacă clientul există deja după CUI sau nume
          const [existing] = await db
            .select()
            .from(clients)
            .where(
              and(
                eq(clients.tenantId, tenantId),
                cui
                  ? sql`REPLACE(${clients.cui}, "RO", "") = ${cui.replace(/^RO/i, "")}`
                  : eq(clients.name, denumire)
              )
            )
            .limit(1);

          if (existing) {
            await db
              .update(clients)
              .set({
                sagaCode: cod,
                regCom: regCom || existing.regCom,
                address: adresa || existing.address,
                city: localitate || existing.city,
                phone: telefon || existing.phone,
                email: email || existing.email,
              })
              .where(eq(clients.id, existing.id));
            updated++;
          } else {
            await db.insert(clients).values({
              tenantId,
              name: denumire,
              cui: cui || null,
              sagaCode: cod,
              regCom: regCom || null,
              address: adresa || null,
              city: localitate || null,
              country: "RO",
              phone: telefon || null,
              email: email || null,
              currency: "RON",
              isSupplier: 0,
              isActive: 1,
            });
            imported++;
          }
        }

        console.log(`[SAGA Import Clienti] Done: ${imported} imported, ${updated} updated, ${skipped} skipped`);
        return res.json({ success: true, imported, updated, skipped, total: rows.length });
      } catch (err: any) {
        console.error("[SAGA Import Clienti] Error:", err);
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

  // ── CONTRACTS & DOCUMENTS BULK UPLOAD ────────────────────────────────────
  app.post(
    "/api/upload-contract",
    (req: Request, res: Response, next) => {
      contractUpload.array("files", 100)(req, res, (err: any) => {
        if (err) {
          res.status(400).json({ error: err.message || "Format de fișier neacceptat" });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "Niciun fișier selectat" });
          return;
        }

        const uploadDirDist = path.join(process.cwd(), "dist", "public", "uploads", "contracts");
        const uploadDirClient = path.join(process.cwd(), "client", "public", "uploads", "contracts");
        await fs.promises.mkdir(uploadDirDist, { recursive: true }).catch(() => {});
        await fs.promises.mkdir(uploadDirClient, { recursive: true }).catch(() => {});

        const results = [];
        for (const file of files) {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${safeName}`;
          const filePathDist = path.join(uploadDirDist, key);
          const filePathClient = path.join(uploadDirClient, key);
          await fs.promises.writeFile(filePathDist, file.buffer);
          await fs.promises.writeFile(filePathClient, file.buffer).catch(() => {});

          const fileUrl = `/uploads/contracts/${key}`;

          const { text, html } = extractContractTextAndHtml(file.buffer, file.originalname);
          const meta = parseContractMetadata(text, file.originalname);

          results.push({
            fileKey: key,
            fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
            detectedCui: meta.detectedCui,
            detectedNumber: meta.detectedNumber,
            detectedDate: meta.detectedDate,
            detectedValue: meta.detectedValue,
            detectedCurrency: meta.detectedCurrency,
            detectedPartnerName: meta.detectedPartnerName,
            detectedOfferNumber: meta.detectedOfferNumber,
            detectedOfferDate: meta.detectedOfferDate,
            detectedWoodEssence: meta.detectedWoodEssence,
            extractedHtml: html || null,
          });
        }

        res.json({ success: true, count: results.length, files: results });
      } catch (err: any) {
        console.error("Contract upload error:", err);
        res.status(500).json({ error: err.message || "Eroare la încărcare documente" });
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
        const tenantId = resolveRequestTenant(req, req.body.tenantId || req.query.tenantId);
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
            const tva = String(row.TVA || row.Tva || row.tva || "21").trim();
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
              await db.insert(sagaArticles)
                .values(values)
                .onDuplicateKeyUpdate({
                   set: {
                     name: sql`VALUES(name)`,
                     unit: sql`VALUES(unit)`,
                     vatRate: sql`VALUES(vatRate)`,
                     category: sql`VALUES(category)`,
                     accountingAccount: sql`VALUES(accountingAccount)`,
                     barcode: sql`VALUES(barcode)`,
                     isActive: sql`VALUES(isActive)`,
                   }
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

